---
description: Kick off the full feature workflow from a rough idea. Creates the ClickUp epic + spec ticket, then invokes the product-manager agent.
---

You are about to orchestrate a new feature for the Massage Tulum project. You are acting in PM mode (the main session — there is no sub-agent for PM).

The feature description from the human:

$ARGUMENTS

Follow this workflow precisely:

## Step 1 — Sanity check the request

Before doing anything else:
- Re-read `CLAUDE.md` if you haven't this session.
- Confirm the request fits the v1 scope (studio-owner-first; customer flow comes later).
- If the request is for the customer flow, surface this and ask the human if they want to proceed or queue it for v2.
- If the request is too vague to even create a ticket title, ask one clarifying question and stop.

## Step 2 — Create ClickUp tickets

Using the ClickUp MCP tools:
1. Find or create the relevant epic in the `Massage Tulum` space.
2. Create a spec ticket under the epic with:
   - Title: `[SPEC] <feature name>`
   - Status: `Spec`
   - Description: the human's original request (verbatim) + any clarifications gathered
   - Custom field `Agent`: leave blank (PM agent will fill)

## Step 3 — Invoke the product-manager agent

Pass these inputs to the product-manager agent:
- The ticket ID and link
- The feature description
- Any related existing specs you found
- Any constraints from CLAUDE.md or ADRs that obviously apply

Wait for the product-manager to return its summary.

## Step 4 — Surface to human (GATE 1)

Once the product-manager returns:
- Post the spec link in the chat.
- List any open questions explicitly.
- **Stop here.** Do not invoke any further agents until the human has reviewed the spec and explicitly approves (e.g., "spec looks good, proceed" or sets the ClickUp ticket to `Spec Approved`).

## Step 5 — After approval

Once the human approves:
- Identify if research is needed (from the spec's "Research needed" section).
- If yes, invoke the `researcher` agent first.
- Then invoke `architect` (with researcher report links if applicable).
- Then invoke `designer` in parallel with architect if the work is FE-relevant.
- Wait for both to complete.
- Surface architect ADRs and designer doc to the human (GATE 2).

## Step 6 — After GATE 2 approval

- Use the architect's ticket breakdown.
- Invoke developers (`developer-be`, `developer-fe`, `developer-devops`) per ticket, respecting dependencies.
- For each PR opened: invoke `reviewer`.
- Loop reviewer ↔ developer until reviewer verdict is `Approved`.
- Then invoke `qa`.
- Once QA reports `Ready to merge`, surface the PR to the human (GATE 3).

## Rules

- Do NOT skip approval gates.
- Do NOT invoke multiple developers on the same files concurrently — sequential within an overlapping area.
- If any agent returns "stop and ask the human", surface immediately and wait.
- If a free tier limit is hit, surface and wait — never silently provision a paid tier.

Begin Step 1 now.
