# Massage Tulum — Project Context

This file is loaded automatically at the start of every Claude Code session. Read it carefully.

---

## What we're building

**Massage Tulum** is a booking platform connecting massage studios in Tulum, Mexico with customers (primarily tourists). The first user we're optimizing for is the **studio owner** managing their bookings, services, therapists, and availability. Customer-facing booking comes after the studio management experience is solid.

**v1 success:** A real studio in Tulum can fully manage their offerings, accept bookings, and operate their business through this platform.

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) — desktop-first, mobile-responsive |
| Backend | NestJS (TypeScript) + Swagger/OpenAPI |
| Database & Auth | Supabase (Postgres + Supabase Auth) — free tier in dev |
| Payments | Stripe — deferred to a later sprint |
| Email | Brevo (free tier) |
| WhatsApp | Provider TBD by Architect (likely Meta Cloud API or Twilio) |
| Hosting (FE) | Vercel |
| Hosting (BE) | TBD by Architect (Vercel serverless is incompatible with long-running NestJS, so likely Railway / Fly / Render) |
| Monorepo | Turborepo + pnpm workspaces |
| i18n | Spanish + English (next-intl) |
| Project mgmt | ClickUp (audit trail, tickets, docs) |
| Code | GitHub |
| CI/CD | GitHub Actions |

Architecture decisions live in `docs/adr/`. Changes to the stack require an ADR and human approval.

---

## Repo layout

```
massage-tulum/
├── apps/
│   ├── web/              # Next.js — studio-owner UI first, customer flow later
│   └── api/              # NestJS — REST API with Swagger at /api/docs
├── packages/
│   ├── shared/           # Shared TS types, validation schemas (zod)
│   └── ui/               # Shared React components (later)
├── docs/
│   ├── adr/              # Architecture Decision Records (numbered, immutable once accepted)
│   ├── runbooks/         # Operational runbooks
│   ├── design/           # Design specs and tokens
│   ├── research/         # Researcher reports
│   └── templates/        # Spec / ticket / ADR templates
├── .claude/
│   ├── agents/           # Sub-agent definitions
│   ├── commands/         # Slash commands
│   └── settings.json     # Tool permissions, hooks, MCP servers
├── .github/
│   └── workflows/        # CI
└── CLAUDE.md             # This file
```

Subdirectory `CLAUDE.md` files (e.g. `apps/api/CLAUDE.md`) are loaded contextually when working in that area. Add them as the codebase grows.

---

## How we work — the orchestration model

This is critical. **Read it before invoking any sub-agent.**

The main Claude Code session acts as the **Project Manager**. The PM does not exist as a sub-agent (sub-agents cannot spawn other sub-agents — Claude Code constraint). When you start a session and want to do project work, the main session reads this file, picks up the workflow, and orchestrates by invoking sub-agents one at a time.

### The standard feature workflow

```
1. Human: "/new-feature <description>"
   ↓
2. Main session (in PM mode) creates a ClickUp epic + initial spec ticket
   ↓
3. Invoke `product-manager` sub-agent → produces spec
   ↓
🛑 GATE 1: Human reviews and approves spec in ClickUp
   ↓
4. (Parallel where possible) Invoke `researcher` for unknowns,
   then `architect` for design, then `designer` for UI
   ↓
🛑 GATE 2: Human reviews architecture + design
   ↓
5. Architect breaks the work into dev tickets (BE / FE / DevOps)
   ↓
6. Invoke `developer-be`, `developer-fe`, `developer-devops` per ticket
   - Each creates a branch, writes code, opens a PR, updates ClickUp
   ↓
7. Invoke `reviewer` against the PR → comments
   ↓
8. Loop back to developer if changes needed
   ↓
9. Invoke `qa` once review passes → functional tests
   ↓
🛑 GATE 3: Human reviews PR and merges to main
```

### Parallel agent execution — always use git worktree isolation

When the orchestrator launches more than one developer agent concurrently, **every concurrent agent must run with `isolation: "worktree"`** in its `Agent` invocation. The "different file paths" rule is necessary but **not sufficient**: by default, sub-agents share a single git working directory with one HEAD. As soon as one agent runs `git checkout -b`, every other agent's writes (and `git status`, and `git stash`) operate on that new branch — even when the agent thinks it's on `main`. Worse, dirty trees during a checkout get auto-stashed, sweeping uncommitted work (including unrelated files like `.claude/settings.json`) into stashes the agents don't track. Wave 1 of Foundation (2026-04-26) hit exactly this: of 5 parallel agents, 2 committed correctly, 3 wrote files into the wrong branch's working tree, and the orchestrator's permission edits ended up stashed and lost-looking. `isolation: "worktree"` gives each agent its own physical checkout (own HEAD, own working tree, own stash list) — they cannot collide. The cleanup at the end is automatic: empty worktrees are removed; agents that produced changes return their branch + path so the orchestrator can fast-forward and PR.

### Pre-merge validation — never declare a wave "done" until CI proves it

Two rules apply to every developer-agent PR before the orchestrator surfaces it for human merge. They exist because Wave 1 of Foundation (2026-04-26) merged 5 PRs that each looked fine in isolation but stacked 6 distinct latent failures the moment they integrated on `main` — eight follow-up fixup PRs to dig out. The pattern is structurally preventable.

**Rule 1 — Fresh-clone integration smoke test.** Before the orchestrator declares a wave done, run from a fresh `git clone` of the merged target branch (or the PR branch if pre-merge): `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm audit --audit-level=high --prod`. Any non-zero exit blocks the wave. "Each ticket's tests passed in isolation" is not enough — integration is where the failures actually surface.

**Rule 2 — PR-branch CI must be green before requesting human merge.** `gh pr checks <pr>` must show all required status checks passing on the PR branch. Do not surface a PR to the human with red CI and a request to merge — the human will not be the integration test. If branch protection enforces required checks (CU-869d29mxg), this is automatic; until then the orchestrator enforces it manually.

When CI is red on a PR, fix on the branch, re-push, wait for green, *then* surface for review. When CI is red on `main` (e.g. inherited from a wave that was merged before this rule existed), fixup PRs are still the right tool — but the underlying mistake is that those PRs should have surfaced their failures *before* their parent wave merged.

### Bug fix workflow

Lighter: skip PM/Architect/Designer unless the bug reveals a design flaw. Go: ticket → developer → reviewer → QA → human merge.

### Research workflow

`researcher` is **not a phase** — it's a utility. Any other agent can request research be done before they continue. The main session handles the invocation.

---

## Agent inventory

All agents live in `.claude/agents/`. Read those files for detailed responsibilities. Quick map:

| Agent | Purpose | Writes code? |
|---|---|---|
| `product-manager` | Specs, acceptance criteria, analytics requirements | No |
| `researcher` | Investigates unknowns, compares options, security/compliance | No |
| `architect` | System design, ADRs, tech decisions, infra | No (writes ADRs + diagrams only) |
| `designer` | UI/UX specs, design tokens, component definitions | No (writes specs + Figma-style descriptions) |
| `developer-be` | NestJS backend implementation | Yes |
| `developer-fe` | Next.js frontend implementation | Yes |
| `developer-devops` | CI/CD, infra-as-code, deployment | Yes (configs, workflows) |
| `reviewer` | PR code review (read-only) | No |
| `qa` | Functional testing, e2e, integration | Yes (test code only) |

The Project Manager role is performed by the main session, not as a sub-agent.

---

## Coding conventions

### Universal
- TypeScript strict mode everywhere. No `any` without a comment justifying it.
- ESLint + Prettier enforced via pre-commit hook.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- One concern per PR. If a PR description needs the word "also", split it.
- Every PR links to its ClickUp ticket (`Closes CU-XXXX` in description).

### Backend (NestJS)
- Module-per-domain structure (e.g., `studios/`, `bookings/`, `therapists/`).
- DTOs with `class-validator` for every endpoint input.
- Swagger decorators on every public endpoint. The Swagger doc IS the API contract.
- Use Supabase JS client server-side; never expose service-role keys to FE.
- Errors: throw NestJS exceptions; let global filter format responses.

### Frontend (Next.js)
- App Router. Server Components by default; `"use client"` only when needed.
- Server actions for mutations where appropriate.
- Tailwind for styling. Use design tokens from `packages/ui` once it exists.
- Forms: react-hook-form + zod resolver. Same zod schemas as backend (in `packages/shared`).
- i18n via next-intl. **No hardcoded strings.** All user-facing copy goes through translation keys, even in v1. Both `es` and `en` populated at the same time — never ship one without the other.

### Database
- Migrations via Supabase CLI. Every schema change is a migration in version control.
- RLS (Row Level Security) policies are mandatory on every table. No exceptions.
- Test RLS policies in CI.

---

## Git workflow

- Branch from `main`: `feat/CU-1234-short-description`, `fix/CU-1234-...`, etc.
- Developer creates branch, commits, pushes, opens PR.
- PR title: `[CU-1234] feat(scope): summary`
- Branch protection on `main`: requires 1 approving PR review + green CI + linear history. **No agent ever merges to main — that's the human's job.**
- Squash-merge only.

---

## ClickUp conventions

ClickUp is the **audit trail and human interface**. It is not the orchestration mechanism.

- Every unit of work has a ticket before code is written.
- Required custom fields: `Agent` (which agent did the work), `PR Link`, `ADR Link` (if applicable), `Spec Link`.
- Status flow: `Backlog` → `Spec` → `Spec Approved` → `In Design` → `Ready for Dev` → `In Development` → `In Review` → `In QA` → `Ready to Merge` → `Done`.
- Every agent's last action before returning **MUST** be:
  1. Update the ClickUp ticket: status, agent field, summary comment.
  2. If decisions were made: create or update an ADR / runbook / spec doc.
- ClickUp Docs hold durable knowledge: architecture decisions (mirrored from ADRs), API contracts, runbooks, onboarding.

---

## Documentation rules

- **ADRs** (`docs/adr/NNNN-title.md`) for any architectural decision: tech choices, schema design, integration patterns. Once accepted, ADRs are immutable. Supersede with a new ADR.
- **Runbooks** (`docs/runbooks/`) for operational procedures: deploy, rollback, incident response, db migrations.
- **Specs** are owned by the PM agent and live in ClickUp Docs (linked from the ticket).
- **API docs**: auto-generated from NestJS Swagger. Never written by hand.
- **READMEs**: every package and app has one.

---

## Security baseline

A full security checklist will be produced by the `researcher` agent in the first sprint. Until then, hard rules:

- **Never commit secrets.** `.env*` files are denied in `.claude/settings.json`.
- **Never log PII** (emails, phone numbers, payment data, names alongside other identifying data).
- **RLS on every Supabase table.** Period.
- **Auth required** on every endpoint unless explicitly marked public (with reviewer approval).
- **CSP headers** on the Next.js app from day one.
- **Dependency scanning** in CI (npm audit, Snyk free tier, or similar — Architect to decide).

---

## Approval gates (human = the project owner)

The human reviews and approves at three gates:

1. **After spec is written** (before architect / designer start).
2. **After architecture + design produced** (before developers start).
3. **PR review before merging to main.**

Agents do not skip these gates. If a gate is missed, the agent stops and surfaces it.

---

## Things agents should NEVER do

- Merge a PR to `main`.
- Push directly to `main`.
- Create or rotate API keys, tokens, or service accounts.
- Approve their own PRs (or other agents' PRs as the sole approver).
- Delete data in any environment.
- Run destructive migrations without an explicit human "yes".
- Change branch protection rules.
- Modify `.claude/agents/`, `.claude/settings.json`, or this file without an explicit human request.
- Skip ADRs for architectural decisions, even small ones.

---

## Environment strategy

- **dev** — current focus. Local + Vercel preview deployments.
- **uat** — added when v1 is feature-complete.
- **prod** — added at launch.

Each environment gets its own Supabase project. No shared databases between envs, ever.

---

## Cost discipline

We're on free tiers where possible:
- Supabase free tier: 500 MB DB, 1 GB storage, **pauses after 1 week of inactivity**. Architect must plan around this.
- Brevo free tier: 300 emails/day.
- Vercel hobby: fine for one developer.
- ClickUp free tier: enough for one user; check limits.

When we hit a free-tier wall, the relevant agent surfaces it and we decide together.

---

## When in doubt

If an agent is unsure, it should:
1. Check this file and its own agent definition first.
2. Look in `docs/adr/` for prior decisions.
3. Search ClickUp for related tickets.
4. **Ask the human in chat.** Never invent an answer to an architectural question.
