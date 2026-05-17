# Repo-native Autonomous Orchestration

The autonomous loop uses the repo, not ClickUp, as the state machine.

## Source of truth order

1. `CLAUDE.md`
2. `docs/roadmap/roadmap.md`
3. `.claude/status.md`
4. Repo docs under `docs/`
5. Git branches, commits, and PRs

## Allowed without human approval

- Read roadmap/specs/ADRs/research/design/QA docs
- Draft or refine specs in `docs/specs/`
- Draft research reports in `docs/research/`
- Draft architecture/design docs in `docs/architecture/` and `docs/design/`
- Create branches for approved implementation slices
- Commit and push branch work
- Open PRs
- Review PRs, resolve reviewer comments, and re-push fixes
- Run lint/typecheck/test/build/audit
- Run QA against PRs
- Merge PRs when `.claude/orchestrator/merge-policy.md` is satisfied:
  CI green, QA passed, reviewer issues resolved, no destructive
  changes, and not touching secrets or billing
- Update `.claude/status.md`

## Must stop for human approval

- Anything requiring external config, credentials, or human accounts
- Secret creation or rotation
- Billing / account changes
- Paid service signups or stack changes
- Production deploys
- Destructive migrations or data deletion
- Changes to branch protection

## Never do autonomously

- Push directly to `main` (always go through a PR)
- Merge a PR that fails any check in `.claude/orchestrator/merge-policy.md`
- Skip RLS for database tables
- Commit secrets
- Create/update/search ClickUp unless explicitly requested
- Delete production data
- Modify branch protection

## Loop shape

```text
recover state
read roadmap + status + git/PRs
pick next unblocked safe action
run one agent/task
validate output
update docs/status
stop at gates or continue to next unblocked item
```
