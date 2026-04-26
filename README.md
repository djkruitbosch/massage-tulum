# Massage Tulum

A booking platform for massage studios in Tulum, Mexico. v1 is studio-owner-first.

## Quick start

If you're a human reading this for the first time: **start with `GETTING_STARTED.md`**.

If you're a Claude Code session: read `CLAUDE.md` first, always. It has the project context, conventions, and orchestration model.

## Layout

```
.
├── CLAUDE.md              Project context for Claude Code
├── GETTING_STARTED.md     Kickoff checklist for the human
├── README.md              You are here
├── apps/
│   ├── web/               Next.js (App Router, TS) — studio-owner UI
│   └── api/               NestJS (TS) — backend with Swagger
├── packages/
│   ├── shared/            Shared zod schemas, TS types
│   └── ui/                Shared React components (later)
├── docs/
│   ├── adr/               Architecture Decision Records
│   ├── runbooks/          Operational runbooks
│   ├── design/            UI/UX specs and tokens
│   ├── research/          Researcher reports
│   └── templates/         Document templates
├── .claude/
│   ├── agents/            Sub-agent definitions
│   ├── commands/          Slash commands
│   └── settings.json      Tool permissions, hooks
└── .github/
    └── workflows/         CI/CD
```

## Tech stack

- **FE:** Next.js (App Router, TS) on Vercel
- **BE:** NestJS (TS) — host TBD per ADR
- **DB & Auth:** Supabase (Postgres + Supabase Auth)
- **Email:** Brevo
- **Payments:** Stripe (deferred to a later sprint)
- **WhatsApp:** TBD per ADR
- **Monorepo:** Turborepo + pnpm workspaces
- **i18n:** next-intl (es + en, always together)
- **PM:** ClickUp (audit trail, tickets, docs)
- **CI:** GitHub Actions

## Status

Pre-development. Scaffolding only. See `GETTING_STARTED.md`.

