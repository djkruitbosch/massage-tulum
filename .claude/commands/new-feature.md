---
description: Kick off the full feature workflow. Accepts either a feature description (creates new ticket) OR an existing Backlog ticket ID like CU-XXXX (picks it up from the roadmap). Then invokes product-manager to write the full spec.
---

You are about to orchestrate a feature for the Massage Tulum project. You are acting in PM mode (the main session — there is no sub-agent for PM orchestration).

The human's input:

$ARGUMENTS

## Step 0 — Detect input type

Look at $ARGUMENTS:

- **If it matches the pattern `CU-XXXX` (or `cu-xxxx`, case-insensitive)** → the human is picking up an existing Backlog ticket from the roadmap. Skip to Step 2.
- **If it's a description (free text)** → the human is starting fresh. Go to Step 1.
- **If $ARGUMENTS is empty or unclear** → list the current Backlog tickets from ClickUp, ask the human "Pick a ticket ID to work on, or describe a new feature." Stop and wait.

## Step 1 — (Free-text path) Sanity check + create ticket

Before doing anything else:
- Re-read `CLAUDE.md` if you haven't this session.
- Confirm the request fits the v1 scope (studio-owner-first; customer flow comes later).
- If the request is for the customer flow, surface this and ask the human if they want to proceed or queue it for v2.
- If the request is too vague to even create a ticket title, ask one clarifying question and stop.

Then create the ClickUp ticket:
- Find or create the relevant epic/folder in the `Massage Tulum` space.
- Create a spec ticket:
  - Title: `[SPEC] <feature name>`
  - Status: `Spec`
  - Description: the human's original request (verbatim) + any clarifications gathered

Continue to Step 3.

## Step 2 — (Ticket ID path) Pull existing ticket

Fetch the existing ticket from ClickUp:
- Verify it exists in the Massage Tulum space.
- Verify its current status. Expected: `Backlog` (if from roadmap) or `Spec` (if previously partially worked).
- Read the ticket title, description, and any comments.

If the ticket is a Backlog feature ticket from the roadmap:
- Update it in place: change title from `[FEATURE] X` to `[SPEC] X`.
- Move status from `Backlog` to `Spec`.
- Add a comment: "Picked up for spec writing on YYYY-MM-DD."

If the ticket already has a partial spec (status `Spec` already), confirm with the human whether to rewrite from scratch or extend the existing one.

If the ticket is in any later status (`Spec Approved`, `In Design`, etc.), STOP. The feature is already past the spec stage. Surface this to the human and ask what they actually want.

Continue to Step 3.

## Step 3 — Invoke product-manager in spec mode

Pass these inputs to the product-manager sub-agent:
- **Mode:** `spec` (NOT roadmap)
- The ticket ID and link
- The feature description (from ticket or from $ARGUMENTS)
- Roadmap doc link (if this came from a roadmap ticket)
- Any related existing specs you found
- Any constraints from CLAUDE.md or ADRs that obviously apply

Wait for the product-manager to return its summary.

## Step 4 — Surface to human (GATE 1)

Once the product-manager returns:
- Post the spec link in chat.
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
- The first feature triggers a lot of foundational scaffolding (Turborepo init, Next.js init, NestJS init, CI, Vercel, etc.). The architect's design doc will explicitly call this out. Don't be surprised if the first feature has more dev tickets than subsequent ones.

Begin Step 0 now.
