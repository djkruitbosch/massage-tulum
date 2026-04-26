# ADR 0000: Record architecture decisions

**Status:** Accepted
**Date:** 2026-04-26
**Author:** project owner (human)

## Context

We need to track significant architecture / technology choices in a way that:
- Survives team and tooling changes.
- Lives next to the code.
- Lets future contributors (human and AI) understand *why* a decision was made, not just *what* was decided.
- Is searchable and citable from agent prompts.

## Decision

We adopt the Architecture Decision Records (ADR) pattern, popularized by Michael Nygard.

- ADRs live in `docs/adr/`.
- File format: `NNNN-kebab-title.md`, four-digit zero-padded sequence.
- Use the template in `docs/templates/adr-template.md`.
- Once an ADR is `Accepted`, its content is immutable. To change the decision, write a new ADR with status `Accepted` and update the old one's status to `Superseded by ADR-XXXX`.
- All agents read every ADR before making architectural decisions (per `architect.md`).

## Consequences

**Positive:**
- A canonical, version-controlled record of why the system looks the way it does.
- Easy to onboard new humans or new agent sessions.
- Forces architects to think about consequences and alternatives, not just the choice.

**Negative:**
- Adds friction to small decisions. We mitigate by reserving ADRs for decisions that affect a module or larger.
- Outdated ADRs can mislead. We mitigate via the `Superseded by` rule.

**Neutral / follow-up:**
- ADRs are mirrored to ClickUp Docs as read-only summaries (so non-technical stakeholders can browse).

## Alternatives considered

- **No ADRs, just commit messages.** Commit messages are too short and not searchable as decisions.
- **Wiki / Notion only.** Decisions drift from the code; harder to keep agents in sync with project state.
- **Code comments at the decision site.** Doesn't capture "why we said no to alternatives".

## Implementation notes

- Template at `docs/templates/adr-template.md`.
- Architect agent (`/.claude/agents/architect.md`) is responsible for writing ADRs.
- Reviewer agent checks for missing ADRs when an architectural decision shows up in a PR without one.
