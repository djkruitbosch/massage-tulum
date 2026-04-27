# ADR 0005: Dependency Scanning Strategy

**Status:** Accepted
**Date:** 2026-04-26
**Author:** architect (agent)
**Context tickets:** CU-869d29f0x

## Context

The project must scan for known CVEs in npm dependencies. `CLAUDE.md` lists "Dependency scanning in CI (npm audit, Snyk free tier, or similar — Architect to decide)" as a requirement. This ADR makes that decision.

Forces at play:
- Cost discipline: free tiers only in v1.
- Developer overhead: scanning must be automated, not manual.
- Signal quality: the scanner must fail CI on exploitable vulnerabilities without creating excessive noise (false positives kill discipline).
- 1-developer team: no dedicated security engineer to triage Snyk dashboards.

## Decision

**Use GitHub Dependabot for automated PR-based dependency upgrades + `pnpm audit --audit-level=high --prod` in CI.**

No Snyk in v1.

### Component 1: GitHub Dependabot

Configured via `.github/dependabot.yml`. Dependabot scans the npm dependency graph weekly (or at a configured interval) and opens pull requests to upgrade outdated or vulnerable packages. It is free for all GitHub repositories.

Configuration choices:
- **Ecosystem:** `npm` (covers all `packages/` and `apps/` pnpm workspaces).
- **Schedule:** Weekly (Monday morning). Daily scanning creates PR noise for a 1-person team.
- **Open PR limit:** 5 concurrent Dependabot PRs maximum. Prevents queue flooding.
- **Auto-rebase:** enabled (Dependabot rebases its own PRs when `main` is updated).
- **Ignore:** none initially. Add ignores for packages with known breaking upgrade paths as they arise.

### Component 2: `pnpm audit --audit-level=high --prod` in CI

Runs on every push as a required CI status check (see ADR-0004).

Failure policy:
- **HIGH and CRITICAL CVEs in production deps:** CI fails. PR cannot merge.
- **HIGH and CRITICAL CVEs in dev deps:** CI warns (logged, not a hard failure). Rationale: a CVE in a dev-only tool (e.g., TypeScript, ESLint) does not affect the deployed application's attack surface.
- **MODERATE and LOW CVEs anywhere:** CI warns but does not fail. The signal-to-noise ratio on low-severity CVEs is poor; blocking merges on them creates friction with no meaningful security gain.

Override procedure (for cases where no fix is available and the vulnerability is accepted):
1. Document the CVE ID, affected package, reason for acceptance, and a review-by date in a comment in the relevant ticket.
2. Add the package to a `.pnpmauditignore` allowlist (or use `pnpm audit --ignore` — exact mechanism confirmed by developer-devops at implementation time against pnpm 10.x docs).
3. The override expires on the review-by date and must be re-evaluated.

### GitHub native Secret Scanning + Push Protection

Enabled at the repository level by DevOps (GitHub repository settings → Security → Code security and analysis). This is always-on and catches secrets in commits before they reach the remote. It is free for public repositories and included in GitHub's standard offering. This is complementary to gitleaks in CI (see ADR-0004) — gitleaks catches secrets in CI diffs; Secret Scanning + Push Protection catches at push time.

These are configured by DevOps in the GitHub repo settings ticket, not in a workflow file.

## Consequences

- **Positive:**
  - Zero cost: Dependabot is free, `pnpm audit` is a built-in pnpm command, GitHub Secret Scanning is free.
  - Dependabot PRs are actionable — they include the CVE description, affected versions, and a direct link to the fix.
  - `pnpm audit` in CI ensures no vulnerable production dep ships even if Dependabot's weekly cadence misses something.
  - Secret Scanning + Push Protection prevents the most common accidental credential exposure.

- **Negative:**
  - Dependabot PRs can accumulate if not reviewed regularly. The 5-PR cap mitigates flooding.
  - `pnpm audit` does not have a built-in allowlist mechanism as mature as Snyk's ignore rules. The workaround (`.pnpmauditignore` or per-package ignore flags) is functional but less polished.
  - No continuous monitoring dashboard (Snyk provides one). The team relies on weekly Dependabot PRs + per-push audit checks instead of a real-time vulnerability feed.

- **Neutral / follow-up work:**
  - Developer-devops creates `.github/dependabot.yml` as part of the GitHub repo configuration ticket.
  - Human enables GitHub Secret Scanning + Push Protection in the repository settings (cannot be done via YAML file — it is a GitHub UI setting).
  - If a CVE is discovered between Dependabot weekly runs, the developer can run `pnpm audit` locally and open a manual upgrade PR.
  - At v1.1 or when the team grows, re-evaluate Snyk or Socket.dev as supplements.

## Alternatives considered

**Snyk (free tier):** Considered. Snyk free tier covers open-source projects and provides a nice dashboard + IDE plugin. Rejected for v1 because:
  - The free tier requires a Snyk account and CI integration setup (non-trivial; a separate token to manage).
  - For a 1-developer team, the dashboard value is low — there is nobody to triage it daily.
  - `pnpm audit` + Dependabot covers the same CVE database (npm Advisory Database) with zero additional setup.
  - Snyk adds marginal benefit over `pnpm audit` at v1 scale. Re-evaluate at team growth.

**Renovate (instead of Dependabot):** Considered. Renovate is more configurable than Dependabot (monorepo-aware, grouping rules, automerge for patch bumps). Rejected for v1 because:
  - Adds setup complexity (configuration file, GitHub App install or self-host).
  - Dependabot is sufficient for a 1-developer monorepo with a small dependency graph.
  - Revisit if Dependabot PR noise becomes unmanageable.

**`npm audit` instead of `pnpm audit`:** Not applicable. The project uses pnpm. `npm audit` in a pnpm workspace does not correctly resolve the workspace lockfile.

## Implementation notes

- `.github/dependabot.yml` — developer-devops authors this as part of the GitHub repo configuration ticket.
- `pnpm audit --audit-level=high --prod` — incorporated into the `pnpm-audit` CI job (ADR-0004). Developer-devops writes the workflow step.
- Secret Scanning + Push Protection — human enables in GitHub repository settings → Code security and analysis. This cannot be automated via a workflow file.
- The `.pnpmauditignore` file (if used) should be reviewed in PRs like any other config file — it represents accepted risk decisions.
