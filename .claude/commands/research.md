---
description: Invoke the researcher agent for a standalone research task (e.g., compare two libraries, investigate a security topic, evaluate a vendor).
---

You are kicking off a research task for Massage Tulum.

Research question / topic from the human:

$ARGUMENTS

## Workflow

1. **Confirm clarity:** If the question is ambiguous (e.g., "look into WhatsApp"), ask one clarifying question and stop.

2. **Create ClickUp ticket** (optional but preferred for tracking):
   - Title: `[RESEARCH] <topic>`
   - Status: `In Development`
   - Description: research question + why it matters + decision deadline if any

3. **Invoke the `researcher` agent.** Pass:
   - The research question
   - Constraints from CLAUDE.md and any obviously relevant ADRs
   - Any context the human added

4. **When researcher returns:**
   - Post the report link in chat.
   - Surface the recommendation.
   - If the research was triggered by another agent's work, return to that agent's flow with the answer.
   - If standalone, ask the human if they want to act on the recommendation.

## Rules

- Researcher is read-only. If the human wants the recommendation implemented, that's a separate ticket and a separate agent.
- Researcher reports go in `docs/research/` and ClickUp Docs. Both, always.

Begin now.
