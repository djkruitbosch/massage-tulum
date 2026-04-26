---
description: Kick off a bug fix workflow. Lighter than /new-feature — skips PM/architect/designer unless the bug reveals a design flaw.
---

You are orchestrating a bug fix for Massage Tulum.

Bug description from human:

$ARGUMENTS

## Workflow

1. **Triage:** Read the bug description and any logs / screenshots. Decide:
   - Is this a true bug (something broken that worked / should work)?
   - Or is this a missing feature dressed as a bug? (If so, redirect to `/new-feature`.)
   - Does this reveal a deeper design flaw? (If so, escalate — invoke architect to look before fixing.)

2. **Create ClickUp ticket:**
   - Title: `[BUG] <short description>`
   - Status: `In Development`
   - Description: bug report + reproduction steps + expected vs actual

3. **Pick the right developer:**
   - Backend logic / data / API → `developer-be`
   - UI / forms / rendering → `developer-fe`
   - CI / deploy / env → `developer-devops`

4. **Invoke the developer.** Pass:
   - Ticket link
   - Reproduction steps
   - Logs / screenshots

5. **Once PR is opened:** invoke `reviewer`, then `qa`.
   - QA writes a regression test for the bug. **No bug fix merges without a regression test.**

6. **Surface PR to human (GATE 3).**

## Rules

- If the bug is in production (when prod exists), escalate severity. Surface immediately.
- If the bug indicates a security issue, stop and ask the human before any code is written. Security fixes may need different disclosure handling.
- Always require a regression test. Fixing a bug without a test means it'll come back.

Begin triage now.
