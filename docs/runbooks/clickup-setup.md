# Runbook: ClickUp setup

**Last updated:** 2026-04-26
**Owner:** Project owner (human)

## When to use this

When setting up ClickUp for the Massage Tulum project for the first time, or when onboarding a new collaborator.

## Pre-conditions

- A ClickUp account (free tier is fine for solo dev — you'll hit limits eventually).
- Claude Code installed.
- Your account has admin rights on at least one ClickUp Workspace, OR you've created a fresh workspace for this project.

## 1. Workspace structure

ClickUp hierarchy: Workspace → Space → Folder → List → Task → Subtask.

For Massage Tulum:

```
Workspace: <your name or org>
└── Space: Massage Tulum
    ├── Folder: Backlog
    │   └── List: Features
    │   └── List: Bugs
    │   └── List: Research
    │   └── List: Chores
    ├── Folder: Active sprint
    │   └── List: Current sprint
    └── Folder: Done
        └── List: Archive (last 30 days)
```

You can simplify to a single list to start ("Massage Tulum" with everything in it) and split later. The agents only care about ticket IDs and statuses, not the folder structure.

## 2. Required custom fields

Create these as workspace-level or space-level custom fields. **All four must exist** before agents start filing tickets, or their final-action checklist will fail.

| Field | Type | Description |
|---|---|---|
| `Agent` | Dropdown | Which agent did the most recent work. Options: `product-manager`, `researcher`, `architect`, `designer`, `developer-be`, `developer-fe`, `developer-devops`, `reviewer`, `qa`, `human` |
| `PR Link` | URL | Link to the GitHub PR. |
| `ADR Link` | URL | Link to the ADR file (if architectural). |
| `Spec Link` | URL | Link to the spec doc in ClickUp Docs. |

To create custom fields: Space settings → Custom Fields → Add new field.

## 3. Status workflow

Edit the default statuses for the Space (or for each List, your call). Use exactly these statuses, in this order:

1. `Backlog` — not yet picked up
2. `Spec` — product-manager is writing the spec
3. `Spec Approved` — human has approved at GATE 1
4. `In Design` — architect / designer working
5. `Ready for Dev` — design approved at GATE 2, ticket has all info needed
6. `In Development` — developer is writing code
7. `In Review` — PR open, reviewer is reviewing
8. `In QA` — code review passed, QA is testing
9. `Ready to Merge` — QA passed, awaiting human merge
10. `Done` — merged

ClickUp lets you mark statuses as "Open / Active / Done" — set:
- Open: Backlog, Spec, Spec Approved
- Active: In Design, Ready for Dev, In Development, In Review, In QA, Ready to Merge
- Done: Done

## 4. Ticket templates

Create ClickUp task templates for these types. Set them up via Settings → Templates → Task templates.

### Feature spec ticket

Title: `[SPEC] <feature name>`
Status: Spec
Description:
```
## Original request
<verbatim from human>

## Initial scope notes
- Studio-owner-first? Customer-facing? Both?
- Free-tier impact?
- Localization implications?

## Blocked by / depends on
<links if any>
```

### Bug ticket

Title: `[BUG] <short description>`
Status: In Development
Description:
```
## Reproduction
1. Step
2. Step

## Expected
...

## Actual
...

## Environment
Browser / OS / device:
URL:
Date observed:

## Logs / screenshots
...
```

### Research ticket

Title: `[RESEARCH] <topic>`
Status: In Development
Description:
```
## Question
One sentence.

## Why it matters
Why does this need to be answered now?

## Decision deadline
Date or "not blocking".

## Constraints to respect
- ...
```

### Dev ticket (created by architect)

Title: `[<scope>] <task description>` (e.g., `[BE] Add bookings table + RLS policies`)
Status: Ready for Dev
Description:
```
## Parent
<link to spec / architecture doc>

## Acceptance criteria
1. ...
2. ...

## Implementation notes
<from architect's design doc>

## Out of scope
- ...

## Depends on
- ...
```

## 5. ClickUp Docs structure

Create these top-level docs in the Massage Tulum Space:

```
Docs/
├── Specs/
│   ├── <Epic 1>/
│   │   ├── <Feature 1.1>
│   │   └── <Feature 1.2>
│   └── ...
├── Architecture/
│   ├── <Feature 1.1> design
│   └── ...
├── Design/
│   ├── <Feature 1.1> design
│   └── ...
├── Research/
│   └── ...
├── Runbooks/  (mirror of docs/runbooks/)
└── ADRs/      (mirror of docs/adr/ — read-only summaries)
```

Specs / Architecture / Design / Research live primarily in ClickUp Docs (so non-technical stakeholders can read them). ADRs and runbooks live primarily in the repo (so they version with the code) and have summary mirrors in ClickUp.

## 6. ClickUp MCP server setup

Install the ClickUp MCP server so Claude Code can read / update tickets directly.

1. Get a ClickUp API token: ClickUp → Settings → Apps → API Token. Copy it.
2. Find the official ClickUp MCP server (https://docs.clickup.com or the MCP registry — check current docs since this evolves).
3. Add it to your global Claude Code config or to `.claude/settings.json` (project-level) under an MCP servers section. Refer to current Claude Code docs for the exact syntax — it has changed across versions.
4. Test: in a Claude Code session, ask "list my ClickUp spaces". If it returns a list, you're good.

**Security note:** Your ClickUp API token has full access to your workspace. Store it as an environment variable, not in committed files. Use `.claude/settings.local.json` if you must put it in a settings file (it's gitignored by default).

## 7. Verification

You're set up correctly when:

- [ ] Space `Massage Tulum` exists.
- [ ] All four custom fields (`Agent`, `PR Link`, `ADR Link`, `Spec Link`) are visible on a new task.
- [ ] All ten statuses appear in the status dropdown.
- [ ] Ticket templates work (creating a task lets you pick a template).
- [ ] ClickUp MCP is connected and Claude Code can list spaces.

## Common failures

- **Custom field doesn't show on task:** field was created on a different space than the one you're working in.
- **Status workflow not appearing:** statuses are configured per-list or per-folder; check the level you set them at.
- **MCP can't authenticate:** token expired or insufficient scope. Regenerate.

## Rollback

To undo this setup: archive the Space. Don't delete — you may want the audit trail later.
