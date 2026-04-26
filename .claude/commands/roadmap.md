---
description: Collaborate with the product-manager agent in roadmap mode to enumerate, prioritize, and sequence the v1 feature set. Produces a roadmap doc + one Backlog ticket per feature (no specs yet — those come later via /new-feature).
---

You are about to facilitate a roadmap session for the Massage Tulum project. You are acting in PM mode (the main session — there is no sub-agent for PM orchestration).

The human's input — what they said when invoking this command, if anything:

$ARGUMENTS

## What this command is for

This is **roadmap mode**, not feature spec mode. The goal is BREADTH: enumerate the universe of features needed for v1 to be successful, prioritize them, sequence them by dependency. NOT to write deep specs.

Output is:
1. A roadmap doc in ClickUp Docs
2. One ClickUp ticket per feature in `Backlog` status, with a 1-line description (NO full spec)
3. A prioritized, sequenced summary returned to the human

Each feature ticket can later be picked up via `/new-feature CU-XXXX` which triggers the product-manager to write the full spec at that point.

## Workflow

### Step 1 — Re-read the source of truth

Before invoking the product-manager:
- Re-read `CLAUDE.md`. Specifically: "What we're building", "v1 success" criteria, the studio-owner-first scope, deferred items (Stripe), free-tier constraints.
- Look in ClickUp's Massage Tulum space for any existing tickets. If there are any beyond the test ticket, surface them — the human may have already filed thoughts.
- Note any existing ADRs in `docs/adr/` (there shouldn't be any project-specific ones yet, just ADR-0000).

### Step 2 — Invoke the product-manager in roadmap mode

Call the `product-manager` sub-agent with these explicit inputs:

- **Mode:** `roadmap` (NOT `spec` — the agent file describes both modes; tell it which)
- **Project context:** v1 is studio-owner-first; customer flow is v2; Stripe deferred; free-tier-first; es+en always together
- **Goal:** Produce a v1 feature inventory with priorities and sequencing, NOT individual specs
- **Human's input:** whatever they passed in $ARGUMENTS, or note "no specific input — discover features collaboratively"
- **What to produce:**
  - A roadmap doc following the roadmap template (see product-manager.md)
  - A list of features with: title, 1-line description, priority (P0/P1/P2), rough size (S/M/L), dependencies
  - For each feature: a draft Backlog ticket title

### Step 3 — Surface the draft to the human BEFORE creating tickets

Critical: do NOT create ClickUp tickets immediately when the product-manager returns.

Instead:
- Post the roadmap summary in chat
- Show the prioritized feature list
- Ask the human: "Ready to commit this to ClickUp as Backlog tickets, or want to revise?"

This is because creating 20+ tickets is annoying to undo if the list isn't right. Cheap to revise on a chat draft. Painful to revise across 20 tickets and a Doc.

### Step 4 — On approval, create the artifacts

Once the human approves (e.g., "looks good, commit it" or specific edits then approval):

1. Save the roadmap doc to ClickUp Docs at `Massage Tulum / Roadmap / v1 Roadmap (YYYY-MM-DD)`.
2. For each P0 and P1 feature:
   - Create a ClickUp ticket in the Backlog list
   - Status: `Backlog`
   - Title: `[FEATURE] <feature name>` (use [FEATURE] prefix to distinguish from [SPEC]; the spec ticket gets created later by /new-feature when this gets picked up)
   - Description: 1-line description from roadmap + link to the roadmap doc
   - Custom field `Agent`: leave blank (no agent has owned this yet)
   - Optional: set ClickUp's native "Priority" field (Urgent/High/Normal/Low) to match P0/P1
3. For P2 features: create tickets too, but optionally tag them differently or note "P2" in the title prefix to keep them distinguishable.

### Step 5 — Return to human

Final summary in chat:
- Roadmap doc link
- Number of tickets created, by priority
- Suggested next step: which P0 to tackle first, and the exact `/new-feature CU-XXXX` invocation to pick it up

## Rules

- This command does NOT write specs. The product-manager produces a roadmap, not specs.
- This command does NOT invoke architect, designer, or any developer.
- This command does NOT skip the human review step before creating tickets. 20 mistaken tickets are 20 mistakes to clean up.
- If the human's input is too vague to start (e.g., they just typed `/roadmap`), have the product-manager ask 3-5 starting questions to anchor the conversation. Examples: who's the very first studio you're imagining? what does success look like for v1? what's deferred to v2 explicitly?
- Roadmap features should be sized as MVP-sized (1-3 days of agent work each), not epic-sized. If a feature feels like 2 weeks of work, split it.

Begin Step 1 now.
