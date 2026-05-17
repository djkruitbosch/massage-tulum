---
description: Report current repo-native project status from roadmap, .claude/status.md, git branches, PRs, and recent commits. Does not use ClickUp.
---

Read:

1. `CLAUDE.md`
2. `docs/roadmap/roadmap.md`
3. `.claude/status.md`
4. `git status`, recent commits, local branches
5. Open GitHub PRs if `gh` is available

Return a one-screen status report:

## Current focus
- <work item / branch / PR>

## Roadmap next
- <next 1-3 unblocked roadmap items>

## Active work
- <branches / PRs / docs in progress>

## Blocked / needs human
- <approval gates, failed CI, missing decisions>

## Recommended next command
- `/new-feature <id-or-slug>` or another exact command

Rules:

- Do not use ClickUp unless explicitly requested.
- Be terse. Fit on one screen.
- Prefer concrete file paths and PR URLs over general descriptions.
