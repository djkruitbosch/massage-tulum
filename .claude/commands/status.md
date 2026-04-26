---
description: Get a quick status report for the project — open tickets, in-flight PRs, blocked items, and what needs human attention.
---

You are producing a project status report for Massage Tulum.

## Workflow

1. **Pull from ClickUp:**
   - All tickets in the active sprint / backlog with their status and assigned agent.
   - Tickets currently in `Spec Approved`, `In Review`, `In QA`, `Ready to Merge` — these may need human attention.
   - Tickets blocked or stalled (no update in >3 days).

2. **Pull from GitHub:**
   - Open PRs and their CI status.
   - PRs awaiting human review (matched to ClickUp tickets in `Ready to Merge`).
   - Failing CI on any open PR.

3. **Cross-reference:**
   - Any ClickUp ticket in `In Review` without a PR link → flag.
   - Any open PR without a ClickUp ticket → flag.
   - Any PR open >5 days → flag.

4. **Free-tier check (if anything was deployed recently):**
   - Note Supabase activity (warn if approaching 1-week pause threshold).
   - Note any vendor that's mentioned hitting limits.

## Output format

```markdown
# Massage Tulum — Status Report
**Date:** YYYY-MM-DD HH:MM

## Needs your attention
- GATE 1 awaiting approval: <list>
- GATE 2 awaiting approval: <list>
- GATE 3 (PRs ready to merge): <list with PR links>

## In flight
- Specs being written: <list>
- In design / architecture: <list>
- In development: <list with branches>
- In review: <list with PR links + reviewer verdict>
- In QA: <list>

## Blocked / stalled
- <ticket — reason — last update>

## Health
- Free-tier warnings: <or "none">
- CI failures on open PRs: <or "none">

## Recent decisions
- ADRs accepted in last 7 days: <list>
```

## Rules

- Do not invoke any other agents from this command — it's read-only.
- Be terse. The status report should fit on one screen.
- Do not include closed / done tickets unless flagged for retrospective.
