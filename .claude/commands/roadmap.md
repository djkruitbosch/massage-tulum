---
description: Maintain the repo-native product roadmap in docs/roadmap/roadmap.md. No ClickUp tickets are created.
---

You are facilitating roadmap work for Massage Tulum in PM mode.

Human input:

$ARGUMENTS

## Purpose

Maintain `docs/roadmap/roadmap.md` as the source of truth for v1 sequencing. This command does not create ClickUp tickets and does not write deep feature specs.

## Workflow

1. Read `CLAUDE.md`, `docs/roadmap/roadmap.md`, `.claude/status.md`, and existing relevant docs.
2. If the human requested a roadmap update, edit `docs/roadmap/roadmap.md` directly.
3. If the human asked what to do next, identify the next recommended unblocked item from the roadmap.
4. If a new feature idea appears, place it in the appropriate roadmap section with an ID/slug, priority, rough size, dependencies, and short rationale.
5. Update `.claude/status.md` with the roadmap decision or next recommended action.

## Output expectations

Return:

- Roadmap file path
- Summary of changes or next recommended item
- Any assumptions/open questions
- Suggested `/new-feature <id-or-slug>` command for the next work item

## Rules

- Do not create ClickUp tickets.
- Do not invoke architect, designer, or developers.
- Roadmap items should be MVP-sized. Split anything that feels bigger than 1-3 days of agent work.
- Prefer studio-owner-first v1 scope. Customer-facing booking is later unless the roadmap explicitly says otherwise.

Begin by reading the repo-native source of truth.
