# Runbook: Branch Protection + Dependabot Configuration

**Last updated:** 2026-04-26
**Owner:** developer-devops (agent)
**Ticket:** CU-869d29mxg
**Related ADRs:** [ADR-0004](../adr/0004-ci-pipeline-shape-and-caching.md), [ADR-0005](../adr/0005-dependency-scanning.md)

---

## When to use this

Run this runbook **once** after the first CI run on the repo has completed — so GitHub has seen the required status check names at least once and can validate them.

Also run it when onboarding a new environment repo, or when re-applying protection after an accidental removal.

Branch protection cannot be expressed as code in this repo (no Terraform or GitHub Rulesets-as-code in v1). This runbook is the durable specification. The human applies it manually.

---

## Pre-conditions

- The CI workflow (`.github/workflows/ci.yml`) has run at least once on the `main` branch or a PR targeting `main`. GitHub only allows requiring a status check name it has already seen.
- `gh` CLI is installed and authenticated: `gh auth status` returns your GitHub account with `repo` scope.
- You are the repo owner or have admin access to `djb4e/massage-tulum`.
- Secret Scanning and Push Protection are **already enabled** (human action, completed 2026-04-26). Steps in this runbook do not cover those — they are always-on GitHub settings in Security → Code security and analysis.

---

## Apply via `gh api`

Run this **single command** from any directory. It sets all branch protection rules atomically.

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/djb4e/massage-tulum/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci/lint-and-typecheck",
      "ci/test",
      "ci/build",
      "ci/rls-test",
      "ci/gitleaks",
      "ci/pnpm-audit"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
```

**What this enforces:**

| Setting | Value | Why |
|---|---|---|
| `strict: true` | Branches must be up-to-date with `main` before merge | Prevents stale-branch failures after integration |
| `contexts` | All 6 `ci/*` job names from `ci.yml` | Must all pass before merge is allowed |
| `enforce_admins: true` | Protection applies to the repo owner too | See rationale section below |
| `dismiss_stale_reviews: true` | New commits clear the existing approval | Prevents rubber-stamp approvals on post-review pushes |
| `required_approving_review_count: 1` | One human approval required | Human is the only merger per CLAUDE.md |
| `restrictions: null` | No push restriction by username list | Protection by `allow_force_pushes: false` instead |
| `required_linear_history: true` | Squash-merge only produces linear history | Pairs with repo setting: squash-merge only |
| `allow_force_pushes: false` | No force pushes to `main` | Prevents history rewriting |
| `allow_deletions: false` | Cannot delete `main` | Safety rail |

**Credentials:** `gh` uses your currently authenticated token. The token needs `repo` scope. Verify with:

```bash
gh auth status
```

If you see `Token scopes: repo` or similar, you are good. If not, re-authenticate:

```bash
gh auth login --scopes repo
```

---

## Verify

After running the `gh api` command, confirm protection is active:

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/djb4e/massage-tulum/branches/main/protection
```

Look for:
- `required_status_checks.contexts` — should list all 6 `ci/*` names.
- `required_status_checks.strict` — should be `true`.
- `enforce_admins.enabled` — should be `true`.
- `required_pull_request_reviews.required_approving_review_count` — should be `1`.
- `required_linear_history.enabled` — should be `true`.
- `allow_force_pushes.enabled` — should be `false`.
- `allow_deletions.enabled` — should be `false`.

**Smoke test:** Attempt a direct push to `main`:

```bash
git checkout main
git commit --allow-empty -m "test: branch protection smoke test"
git push origin main
```

You should receive: `remote: error: GH006: Protected branch update failed`.

Revert locally: `git reset --hard HEAD~1`

---

## Squash-merge only (repo setting — separate from branch protection)

Branch protection does not control the merge method; that is a separate repo setting. Ensure squash-merge is the only allowed method:

```bash
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/djb4e/massage-tulum \
  -f allow_squash_merge=true \
  -f allow_merge_commit=false \
  -f allow_rebase_merge=false \
  -f delete_branch_on_merge=true
```

`delete_branch_on_merge: true` auto-deletes the feature branch after merge — keeps the repo tidy.

---

## Dependabot configuration

Dependabot is configured via `.github/dependabot.yml`. The file must be committed to the `main` branch to take effect.

**IMPORTANT — permission gap:** The DevOps agent's write permissions do not cover `.github/dependabot.yml` (only `.github/workflows/**` is in scope). The content is provided below. The orchestrator (main session) must commit this file to the branch before the PR is merged, or the human can create the file directly.

**File to create: `.github/dependabot.yml`**

```yaml
# Dependabot configuration — Massage Tulum
# Strategy: weekly scans, max 5 open PRs, grouped by dep type.
# See ADR-0005 for rationale (weekly vs daily, 5-PR cap, no Snyk in v1).
version: 2
updates:
  - package-ecosystem: "npm"
    # "/" scans the workspace root. Dependabot resolves pnpm workspaces
    # from the root package.json and pnpm-lock.yaml automatically.
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "Etc/UTC"
    # Cap at 5 concurrent PRs to prevent queue flooding (ADR-0005).
    open-pull-requests-limit: 5
    target-branch: "main"
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    labels:
      - "dependencies"
    # Group prod and dev deps into separate PRs — reduces noise.
    # Each group becomes one PR instead of one PR per package.
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"
```

Commit this file at `.github/dependabot.yml` in the repo root. Once committed to `main`, Dependabot activates on the next Monday at 06:00 UTC and opens PRs for any outdated packages.

To verify Dependabot is active after commit: GitHub → Insights → Dependency graph → Dependabot tab. It should show "npm" as a configured ecosystem.

---

## UI equivalent (fallback if `gh api` fails)

GitHub Settings → Branches → "Add branch protection rule" (or edit the existing `main` rule):

- **Branch name pattern:** `main`
- Require a pull request before merging:
  - Required approving reviews: `1`
  - Dismiss stale pull request approvals when new commits are pushed: checked
- Require status checks to pass before merging:
  - Require branches to be up to date before merging: checked
  - Status checks that are required (search and add each):
    - `ci/lint-and-typecheck`
    - `ci/test`
    - `ci/build`
    - `ci/rls-test`
    - `ci/gitleaks`
    - `ci/pnpm-audit`
- Require conversation resolution before merging: checked
- Require linear history: checked
- Do not allow bypassing the above settings: checked (this is the UI toggle for `enforce_admins`)
- Allow force pushes: unchecked
- Allow deletions: unchecked

For squash-merge only: Settings → General → Pull Requests section:
- Allow squash merging: checked (set as default)
- Allow merge commits: unchecked
- Allow rebase merging: unchecked
- Automatically delete head branches: checked

---

## Rationale for `enforce_admins: true`

This project has one developer (the human) who is also the repo admin. Exempting admins from branch protection would allow the human to push directly to `main` accidentally, bypassing the CI gate and PR review that the entire orchestration model depends on.

The Wave 1 postmortem (2026-04-26, see CLAUDE.md) showed that integrating unvalidated code on `main` created 8 fixup PRs. The branch protection rules, including `enforce_admins: true`, are the structural fix that makes this pattern impossible — not just discouraged.

The cost: the human cannot emergency-push to `main` without first removing protection. That is the intended behavior. For a genuine emergency, the procedure is:

1. Remove protection temporarily (see "Reverting" section below).
2. Make the fix directly.
3. Re-apply protection immediately.
4. Open a post-incident ticket documenting what happened.

This is a deliberate friction point, not a bug.

---

## Reverting (removing branch protection)

Only remove protection for a genuine emergency. Document the reason in a ClickUp ticket before doing this.

```bash
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/djb4e/massage-tulum/branches/main/protection
```

Re-apply using the "Apply via `gh api`" section above as soon as the emergency is resolved.

**WARNING:** While protection is removed, any contributor (including agents) can push directly to `main`. Re-apply immediately.

---

## Secret Scanning + Push Protection (reference only)

These are already enabled (human action, 2026-04-26). They operate at the GitHub platform level — not via a workflow file. Documented here for completeness.

Location: GitHub → Settings → Code security and analysis:
- Secret scanning: enabled
- Push protection: enabled

These catch secrets at push time (before the commit reaches the remote). They complement the `ci/gitleaks` job in `ci.yml`, which scans diffs in CI. Two layers: push-time block + CI-time scan.

No action needed. Reference: ADR-0005.

---

## Common failures

**"Required status check name not found" when adding via UI:**
The check name must have appeared in at least one CI run before GitHub allows requiring it. Trigger a CI run by opening a draft PR from any branch, then come back and add the check names.

**`gh api` returns 403 Forbidden:**
Your token does not have `repo` scope, or you are not the repo admin. Run `gh auth login --scopes repo` and retry.

**`gh api` returns 422 — "Required status checks contexts must exist":**
The status check name has not run yet (see above). Alternatively, verify that the job `name:` field in `ci.yml` exactly matches the string in the `contexts` array (case-sensitive, spaces matter).

**Dependabot PRs not appearing after committing `dependabot.yml`:**
Dependabot runs on its configured schedule (Monday 06:00 UTC). It does not trigger immediately on file commit. To trigger an immediate scan: GitHub → Insights → Dependency graph → Dependabot → "Check for updates" button.

**Squash-merge button missing in PR UI:**
Verify Settings → General → Pull Requests has only squash merging enabled. Org-level policies (if any) can override repo settings — check org settings if this persists.
