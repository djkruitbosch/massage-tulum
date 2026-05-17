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
- Run lint/typecheck/test/build/audit
- Update `.claude/status.md`

## Must stop for human approval

- Before implementation starts from a new/changed spec
- Before implementation starts from architecture/design docs
- Before merging PRs
- Before paid services, production deploys, destructive migrations, secret rotation, or stack changes

## Never do autonomously

- Merge to `main`
- Push directly to `main`
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
