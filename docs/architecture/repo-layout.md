# Repository Layout

**Date:** 2026-04-26
**Author:** architect (agent)
**Related ADRs:** ADR-0001, ADR-0002, ADR-0003, ADR-0004
**Feature:** Foundation (Feature 0)

This document describes the target monorepo structure that developer agents will scaffold during the Foundation sprint. It is the authoritative reference for where things live. Do not create directories or files outside this layout without a PR that updates this document.

---

## Full tree

```
massage-tulum/
│
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts               # Bootstrap: NestFactory, global pipes, Swagger setup
│   │   │   ├── app.module.ts         # Root module (imports domain modules)
│   │   │   ├── health/               # First domain module
│   │   │   │   ├── health.controller.ts
│   │   │   │   ├── health.module.ts
│   │   │   │   └── health.service.ts
│   │   │   └── common/
│   │   │       ├── filters/
│   │   │       │   └── global-exception.filter.ts   # NestJS global exception filter
│   │   │       └── swagger.ts        # Swagger document builder config
│   │   ├── test/                     # NestJS e2e tests
│   │   ├── CLAUDE.md                 # API-specific agent context (developer-be writes this)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   │
│   └── web/                          # Next.js frontend
│       ├── app/
│       │   └── [locale]/             # next-intl locale segment
│       │       ├── layout.tsx        # Root layout (NextIntlClientProvider)
│       │       └── page.tsx          # Home page placeholder
│       ├── i18n/
│       │   ├── routing.ts            # defineRouting({ locales, defaultLocale, localePrefix })
│       │   └── request.ts            # getRequestConfig (server-side message loading)
│       ├── messages/
│       │   ├── es.json               # Spanish messages (default locale)
│       │   └── en.json               # English messages
│       ├── middleware.ts             # Combined: CSP nonce + next-intl (see ADR-0006)
│       ├── public/                   # Static assets
│       ├── CLAUDE.md                 # Web-specific agent context (developer-fe writes this)
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                       # Shared TS types + Zod schemas
│   │   ├── src/
│   │   │   ├── index.ts              # Barrel export
│   │   │   └── schemas/
│   │   │       └── health.schema.ts  # healthResponseSchema (first Zod schema)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                           # Shared React component library (stub at Foundation)
│       ├── src/
│       │   ├── index.ts              # Barrel export
│       │   └── components/
│       │       └── Button.tsx        # Placeholder Button component
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/                         # Supabase CLI project (repo root, not inside apps/api)
│   ├── config.toml                   # Supabase CLI config (no secrets)
│   ├── migrations/
│   │   └── 20260426000000_init.sql   # First migration: _meta table + RLS (see below)
│   ├── tests/
│   │   ├── rls_baseline_test.sql     # Asserts all public tables have RLS enabled
│   │   └── rls__meta_test.sql        # 4 pgTAP cases for the _meta table
│   └── seed.sql                      # (empty at Foundation; populated per-feature)
│
├── docs/
│   ├── adr/
│   │   ├── 0000-record-architecture-decisions.md
│   │   ├── 0001-backend-hosting-hetzner-coolify.md
│   │   ├── 0002-supabase-environment-strategy.md
│   │   ├── 0003-rls-baseline-conventions.md
│   │   ├── 0004-ci-pipeline-shape-and-caching.md
│   │   ├── 0005-dependency-scanning.md
│   │   └── 0006-csp-nextjs-app-router.md
│   ├── architecture/
│   │   └── repo-layout.md            # This file
│   ├── runbooks/
│   │   ├── be-hosting.md             # (developer-devops writes: provision, rollback, patching)
│   │   └── deployments.md            # (developer-devops writes: deploy flow, env var rotation)
│   ├── research/
│   │   └── 2026-04-26-foundation.md
│   ├── design/                       # (designer writes; empty at Foundation)
│   └── templates/
│       ├── adr-template.md
│       ├── spec-template.md          # (if it exists)
│       └── ticket-template.md        # (if it exists)
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint + typecheck + test + build + RLS + audit + gitleaks
│   │   └── keep-alive.yml            # Supabase ping + gautamkrishnar keepalive
│   └── dependabot.yml                # npm dependency update PRs
│
├── .claude/
│   ├── agents/                       # Sub-agent definitions (do not modify without human approval)
│   ├── commands/                     # Slash commands
│   └── settings.json
│
├── .husky/
│   ├── pre-commit                    # ESLint + Prettier on staged files
│   └── commit-msg                    # Conventional Commits check
│
├── .nvmrc                            # 22 (Node 22 LTS)
├── .gitignore                        # Includes .env, .env.local, .env.*
├── .eslintrc.js                      # (or eslint.config.js for flat config)
├── .prettierrc
├── turbo.json                        # Turborepo pipeline (lint, typecheck, test, build tasks)
├── pnpm-workspace.yaml               # Workspace: apps/*, packages/*
├── package.json                      # Root: packageManager=pnpm@10.x.x, engines.node=22
└── CLAUDE.md
```

---

## Key conventions enforced by this layout

### `supabase/` at repo root

The Supabase CLI project lives at repo root, not inside `apps/api/`. This allows the CI RLS test job to run `supabase start` from the repo root without navigating into an app directory. Both FE and BE can reference generated types (`supabase gen types typescript`) from a single location.

### Domain modules in NestJS

Domain modules follow the pattern: `apps/api/src/<domain>/`. The `health/` module is the first example. Future modules: `studios/`, `therapists/`, `bookings/`, `auth/`. Each module contains its controller, service, and DTOs. Shared utilities (filters, interceptors, guards) live in `apps/api/src/common/`.

### `packages/shared` as single source of truth for schemas

Zod schemas in `packages/shared/src/schemas/` are imported by:
- NestJS DTOs (validated via `class-validator` + `zod.parse` where appropriate)
- Next.js forms (react-hook-form + zod resolver)

The `healthResponseSchema` is the first example. It defines `{ status: z.literal('ok') }`. Both the NestJS health controller response and any FE code that reads it share this schema.

### Initial data model (Foundation only)

The first migration creates a `_meta` table. This is a minimal placeholder that:
1. Demonstrates the full convention: CREATE TABLE → ENABLE RLS → CREATE POLICY → test file.
2. Gives the RLS test suite a non-trivial table to test against.
3. Is not a domain table — it holds no business data.

```sql
-- supabase/migrations/20260426000000_init.sql

CREATE TABLE IF NOT EXISTS public._meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public._meta ENABLE ROW LEVEL SECURITY;

-- Only service_role (admin) can read or write _meta rows.
-- Anon and authenticated users have no access.
CREATE POLICY "service_role only"
  ON public._meta
  AS RESTRICTIVE
  TO service_role
  USING (true)
  WITH CHECK (true);
```

RLS policy rationale: `_meta` is an internal key-value store. No user-facing reads. All policies tested in `rls__meta_test.sql`.

### API health endpoint

`GET /api/health` is the only endpoint scaffolded in Foundation. It returns:

```json
{ "status": "ok" }
```

HTTP 200. No auth required (marked public via reviewer approval per CLAUDE.md convention). Swagger annotated. This establishes the Swagger-first contract convention: every endpoint has `@ApiOperation`, `@ApiResponse` decorators; the Swagger UI at `/api/docs` is the contract.

Response shape defined in `packages/shared/src/schemas/health.schema.ts`:

```typescript
// packages/shared/src/schemas/health.schema.ts
import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

---

## What is NOT scaffolded in Foundation

The following are out of scope for Foundation and belong to subsequent feature sprints:

- Domain tables: `studios`, `therapists`, `services`, `bookings`, `availability`
- Auth flow (magic-link email, session management)
- Any studio management UI beyond the placeholder home page
- Stripe integration
- Brevo email integration
- WhatsApp integration
- Customer-facing booking flow
