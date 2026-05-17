---
description: Start a repo-native bug fix workflow. Creates/uses a lightweight work item in .claude/status.md and opens a PR; no ClickUp by default.
---

Human input:

$ARGUMENTS

## Workflow

1. Read `CLAUDE.md`, `docs/roadmap/roadmap.md`, `.claude/status.md`, relevant ADRs/specs, and recent git history.
2. Reproduce or characterize the bug.
3. Create a short bug slug, e.g. `bug-booking-timezone-display`.
4. Update `.claude/status.md` with the bug slug, suspected area, and owner agent.
5. Invoke the appropriate developer agent.
6. Developer creates a branch `fix/<bug-slug>`, implements, tests, pushes, and opens a PR.
7. Invoke reviewer, then QA if needed.
8. Human merges.

Rules:

- Do not create ClickUp tickets.
- If the bug reveals a product or architecture ambiguity, stop and ask the human or invoke architect/researcher first.
- Do not merge PRs.

Begin by reading the repo-native source of truth.
