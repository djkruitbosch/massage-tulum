# ADR 0004: CI Pipeline Shape and Caching Strategy

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

The project uses GitHub Actions for CI. The monorepo is Turborepo + pnpm 10.x. Key constraints:

- Cold CI must complete in ≤10 minutes. Warm CI (caches hit) must complete in ≤5 minutes. These are spec AC targets.
- The pnpm store cache and Turborepo remote task cache are the primary levers.
- Security gates (gitleaks, pnpm audit, Secret Scanning) must run on every push before merge is allowed.
- RLS tests require a running Supabase local Docker stack (`supabase start`) in CI.
- The Supabase keep-alive workflow is a separate concern (see ADR-0002) but lives in the same `.github/workflows/` directory.
- Branch protection on `main` is a DevOps configuration concern; its required status checks are specified here.

## Decision

### Workflow files

Developer-devops authors the following workflow files (this ADR specifies their purpose and job structure; the actual YAML is the developer's deliverable):

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Primary CI: lint, typecheck, test, build, RLS tests, dep scan, gitleaks |
| `.github/workflows/keep-alive.yml` | Supabase keep-alive + GitHub repo keepalive (see ADR-0002) |

### `ci.yml` job structure

All jobs run on `ubuntu-latest`. Jobs that do not depend on each other run in parallel.

```
on: [push, pull_request]

jobs:
  lint-and-typecheck     # pnpm turbo lint typecheck
  test                   # pnpm turbo test (unit tests)
  build                  # pnpm turbo build
  rls-test               # supabase start → supabase test db → supabase stop
  gitleaks               # gitleaks/gitleaks-action@v2 (secret scanning in diff)
  pnpm-audit             # pnpm audit --audit-level=high (production deps only)
```

`lint-and-typecheck`, `test`, `build` can run in parallel.
`rls-test` requires `supabase start` and runs independently.
`gitleaks` and `pnpm-audit` run independently.

### pnpm + Node caching (from research report R3)

The canonical pattern [20][21]:

1. `pnpm/action-setup@v4` with `version: '10.x'`, `run_install: false`
2. `actions/setup-node@v4` with `node-version: '22'` (do NOT set `cache: 'pnpm'` here — conflicts with pnpm/action-setup)
3. Get store path: `pnpm store path --silent` → `$GITHUB_OUTPUT`
4. `actions/cache@v4`:
   - `path`: the pnpm store path from step 3
   - `key`: `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
   - `restore-keys`: `${{ runner.os }}-pnpm-store-`
5. `pnpm install --frozen-lockfile`

This pattern is consistent across all jobs. Each job that needs installed deps repeats steps 1–5 (cache hit on warm runs reduces install to ~15s).

### Turborepo remote cache

**Vercel Remote Cache** — free for individual accounts, no extra infrastructure. [22][23]

Required GitHub Actions secrets:
- `TURBO_TOKEN` — Vercel personal access token
- `TURBO_TEAM` — Vercel team slug (or personal account slug)

All `pnpm turbo <tasks>` invocations pass these via environment variables:
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

Turborepo uses content-hash-based cache keys. A change to `pnpm-lock.yaml` automatically invalidates all affected task outputs.

### RLS test job specifics

Uses the official `supabase/setup-cli@v1` action [37]:

```yaml
- uses: supabase/setup-cli@v1
  with:
    version: latest
- run: supabase start
- run: supabase db reset    # applies migrations + seed
- run: supabase test db     # runs supabase/tests/*.sql via pgTAP
- run: supabase stop
```

`supabase start` cold boot: 30–60s on `ubuntu-latest`. Total RLS job time: ~45–75s. Well within targets. [36][37]

Docker layer caching for the Supabase stack can be added later if the RLS test suite grows large enough to approach the 90s mark. Not needed at v1 scale.

### gitleaks job

Uses `gitleaks/gitleaks-action@v2`. Scans the diff on every push and pull request. Fails CI if a secret pattern is detected. This is defense-in-depth alongside GitHub's native Secret Scanning + Push Protection (configured at the repo level by DevOps — not a CI job, always-on).

### pnpm-audit job

```bash
pnpm audit --audit-level=high --prod
```

- `--audit-level=high`: fails on HIGH and CRITICAL CVEs only. Moderate and low are warnings (logged but do not fail CI).
- `--prod`: only production dependencies. Dev dependencies (e.g., TypeScript, ESLint) are excluded from hard failures.
- To override for a specific known CVE with no available fix: add an entry to `.pnpmauditignore` (or use `pnpm audit --ignore-registry-data` — exact mechanism TBD by developer-devops based on pnpm 10.x capability). Any override requires a comment with the CVE ID, reason, and a review date.

### Performance targets

| Scenario | Target | Expected actual |
|---|---|---|
| Cold (no caches) | ≤10 min | ~6–8 min (research estimate: pnpm install 90s + turbo build 3–4min + RLS 75s + parallel jobs) |
| Warm (pnpm store hit + turbo remote cache hit) | ≤5 min | ~2–3 min |

These match the research report R3 estimates [20][21][22][23].

### Branch protection settings

DevOps configures the following on the `main` branch (GitHub repository settings → Branch protection rules):

| Setting | Value |
|---|---|
| Require status checks to pass | Enabled |
| Required status checks | `ci/lint-and-typecheck`, `ci/test`, `ci/build`, `ci/rls-test`, `ci/gitleaks`, `ci/pnpm-audit` |
| Require branches to be up to date | Enabled |
| Require a pull request before merging | Enabled |
| Required number of approving reviews | 1 |
| Dismiss stale reviews on new commits | Enabled |
| Require linear history | Enabled |
| Allow squash merging only | Enabled (disable merge commits and rebase merging) |
| Allow force pushes | Disabled |
| Allow deletions | Disabled |

**Status check names:** The job names in `ci.yml` become the status check identifiers. Name jobs with the `ci/` prefix (e.g., `ci/lint-and-typecheck`) to make them clearly identifiable in the branch protection settings UI.

### Husky + lint-staged (pre-commit, not CI)

Configured by developer-devops as part of the Husky ticket. Pre-commit hook runs:
- ESLint on staged `.ts`, `.tsx` files
- Prettier on staged files
- `tsc --noEmit` is NOT run pre-commit (too slow for interactive use; it runs in CI as part of `typecheck`)

This is defense-in-depth for the developer experience, not a substitute for CI.

## Consequences

- **Positive:**
  - Warm CI at ~2–3 min means developers get fast feedback on PRs.
  - Parallel jobs mean gitleaks and pnpm-audit do not add to the critical path.
  - RLS tests run on every push — no way to merge a migration that breaks policies.
  - Vercel Remote Cache is free and zero-infrastructure — no self-hosted cache server to maintain.
  - Branch protection settings are explicit and documented here so they are reproducible.

- **Negative:**
  - `supabase start` adds 30–60s to the RLS job cold boot. Docker layer caching can reduce this later.
  - Each CI job independently installs the pnpm store (cache restores are fast but not free). If this becomes a bottleneck, jobs can be restructured with `needs:` to share an artifact, but that adds complexity.
  - `TURBO_TOKEN` and `TURBO_TEAM` must be added to GitHub secrets before CI can use the remote cache.

- **Neutral / follow-up work:**
  - Developer-devops authors `.github/workflows/ci.yml` and `.github/workflows/keep-alive.yml`.
  - Human configures `TURBO_TOKEN`, `TURBO_TEAM`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` as GitHub Actions secrets.
  - Human configures branch protection settings after the first CI run succeeds (so required status check names are available in the UI).
  - If the pnpm-audit override mechanism in pnpm 10.x differs from the `.pnpmauditignore` pattern, developer-devops adapts and documents.

## Alternatives considered

**Single monolithic CI job (everything sequential):** Rejected. Unnecessary time on the critical path. Parallel jobs are straightforward in GitHub Actions and cut wall-clock time significantly.

**Self-hosted Turborepo remote cache (`ducktors/turborepo-remote-cache` + S3):** Rejected. Adds infrastructure complexity (another service to maintain). Vercel Remote Cache is free for individuals and requires zero operational overhead. [22]

**Run `tsc --noEmit` as a pre-commit hook:** Rejected. Full typecheck on a monorepo takes 30–90s depending on package count. This would make commits painful. CI is the right place for full typecheck.

**Snyk for dependency scanning:** Deferred. See ADR-0005 for the full rationale. Dependabot + `pnpm audit` covers v1 needs.

## Implementation notes

- Job names in `ci.yml` must match the required status check names configured in branch protection. Use the `ci/` prefix.
- The `supabase/tests/` directory must contain at least one `.sql` file when `supabase test db` runs, or the command may exit with an error. The `rls_baseline_test.sql` file (from ADR-0003) satisfies this.
- `pnpm audit --prod` flag syntax: verify against pnpm 10.x docs at implementation time. The `--prod` flag behavior has changed between pnpm versions.
- Turborepo pipeline definition (`turbo.json`) must define `lint`, `typecheck`, `test`, and `build` tasks. Developer-be and developer-fe configure task dependencies within `turbo.json` during scaffold tickets.
- The `gitleaks` job should run on `pull_request` events targeting `main` only, not every push to feature branches (to avoid excessive noise). Developer-devops decides the exact trigger config.

## References

20. pnpm GitHub Actions CI docs — https://pnpm.io/continuous-integration
21. pnpm/action-setup — https://github.com/pnpm/action-setup
22. Turborepo remote cache (Vercel free) — https://turborepo.dev/blog/free-vercel-remote-cache
23. Turborepo remote caching docs — https://turborepo.dev/docs/core-concepts/remote-caching
36. Supabase automated testing GitHub Actions — https://supabase.com/docs/guides/deployment/ci/testing
37. Supabase setup-cli GitHub Action — https://github.com/supabase/setup-cli
