---
description: Kick off the repo-native feature workflow. Accepts a roadmap item id/slug from docs/roadmap/roadmap.md or a new feature description. Produces/updates a spec in docs/specs/ and stops at human gates.
---

You are orchestrating a feature for Massage Tulum in PM mode. There is no PM sub-agent; the main session coordinates agents.

Human input:

$ARGUMENTS

## Step 0 — Read source of truth

Read, in this order:

1. `CLAUDE.md`
2. `docs/roadmap/roadmap.md`
3. `.claude/status.md`
4. Existing relevant docs in `docs/specs/`, `docs/architecture/`, `docs/adr/`, `docs/design/`, and `docs/research/`

ClickUp is legacy-only. Do not create, update, or search ClickUp unless the human explicitly asks.

## Step 1 — Resolve the work item

If `$ARGUMENTS` matches a roadmap item id or slug, use that roadmap item.

If `$ARGUMENTS` is free text, check whether it maps to an existing roadmap item. If it does, use the existing item. If it does not, create a provisional slug and note that the roadmap should be updated after spec approval.

If `$ARGUMENTS` is empty or unclear, list the next 3 recommended unblocked items from `docs/roadmap/roadmap.md` and ask the human to pick one.

## Step 2 — Invoke product-manager in spec mode

Pass these inputs to the `product-manager` agent:

- Mode: `spec`
- Work item id/slug and title
- Roadmap excerpt from `docs/roadmap/roadmap.md`
- Human's original request
- Relevant existing docs found in Step 0
- Constraints from `CLAUDE.md` and accepted ADRs
- Required output path: `docs/specs/<work-item-slug>.md`

The product-manager must update `.claude/status.md` with the spec path and open questions.

## Step 3 — Human approval gate 1

When the spec is written:

- Surface the spec path.
- List open questions.
- Stop. Do not invoke researcher, architect, designer, or developers until the human explicitly approves the spec.

## Step 4 — After spec approval

After explicit approval:

1. Invoke `researcher` first if the spec lists unknowns.
2. Invoke `architect` for technical design.
3. Invoke `designer` in parallel with architect if the work affects UI.
4. Surface architecture/design docs to the human. Stop for Gate 2 approval.

## Step 5 — After architecture/design approval

After explicit approval:

1. Use the architecture doc's implementation-slice breakdown.
2. Invoke the right developer agents per slice, respecting dependencies and worktree isolation.
3. For each PR, invoke `reviewer`.
4. Loop reviewer/developer until review passes.
5. Invoke `qa`.
6. Once QA reports ready, surface PR(s) to the human for merge.

## Rules

- Do not skip approval gates.
- Do not use ClickUp by default.
- Do not merge PRs.
- Do not provision paid services or rotate/create secrets.
- Update `.claude/status.md` after each meaningful step.
- Keep specs and durable decisions in repo docs, not chat-only memory.

Begin Step 0 now.
