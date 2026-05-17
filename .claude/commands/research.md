---
description: Run a repo-native research task. Saves reports in docs/research/ and updates .claude/status.md. No ClickUp by default.
---

Human input:

$ARGUMENTS

## Workflow

1. Read `CLAUDE.md`, `docs/roadmap/roadmap.md`, `.claude/status.md`, relevant ADRs/specs.
2. Invoke `researcher` with the question, constraints, and required output path `docs/research/<topic-slug>.md`.
3. Researcher must use current official/reputable sources for pricing, limits, legal/compliance, or provider comparisons.
4. Researcher saves the report in `docs/research/`.
5. Update `.claude/status.md` with the report path and recommendation.

Rules:

- Do not use ClickUp unless explicitly requested.
- Researcher does not implement. Implementation requires a separate feature/bugfix workflow.

Begin by reading the repo-native source of truth.
