# Spec: Infrastructure Foundation (CU-869d29f0x)

# Spec: Infrastructure Foundation

**Ticket:** [CU-869d29f0x](https://app.clickup.com/t/869d29f0x)
**Status:** Draft (pending GATE 1 human approval)
**Author:** product-manager (agent)
**Date:** 2026-04-26
**Roadmap reference:** [v1 Roadmap (2026-04-26)](https://app.clickup.com/9012175939/docs/8cjnt23-12252)
* * *

## 1\. Problem

Every subsequent feature in Massage Tulum depends on a functioning monorepo, running apps, a database with auth, a CI pipeline, and a deployment target. Without this foundation, no development agent can begin work: there is no repo structure to branch from, no local dev command to run, no database to migrate, no CI to validate PRs, and no deployed URL to test against.

This is a developer-experience and agent-experience problem, not an end-user problem. The "users" here are the development agents (developer-fe, developer-be, developer-devops, qa, reviewer) and indirectly the studio owner — because every user-visible feature is blocked until this ships.

This problem occurs exactly once, at the start of the project, but getting it wrong has compounding cost: a broken monorepo setup or missing RLS baseline silently creates defects that are expensive to fix once features are layered on top.
* * *

## 2\. User stories

*   As a **developer-fe agent**, I need a working Next.js app scaffold in the monorepo so that I can begin building studio-owner screens without configuring the build toolchain from scratch.
*   As a **developer-be agent**, I need a working NestJS API scaffold with Swagger wired so that I can add domain modules without setting up the framework skeleton.
*   As a **developer-be agent**, I need a Supabase project provisioned for `dev` with RLS enforced by default so that any table I create is secure from the first migration.
*   As a **developer-devops agent**, I need a GitHub Actions CI pipeline that validates TypeScript, linting, and tests on every PR so that broken code cannot merge to `main`.
*   As a **developer-fe agent**, I need next-intl wired with placeholder `es` and `en` message files so that I never need to retrofit i18n once real copy is written.
*   As a **qa agent**, I need a `pnpm test` command that runs from the monorepo root and exits 0 on a clean checkout so that I have a known-good baseline to add tests on top of.
* * *

## 3\. Acceptance criteria

### 3.1 Monorepo & tooling

1. Given a fresh `git clone` of the repository, when a developer runs `pnpm install` from the repo root, then it exits 0 and installs all workspace dependencies in under 3 minutes on a standard developer machine (M-series Mac or equivalent Linux CI runner).
2. Given a fresh install, when `pnpm run build` is run from the repo root (via Turborepo), then both `apps/web` and `apps/api` build successfully and the command exits 0.
3. Given a fresh install, when `pnpm run lint` is run from the repo root, then ESLint passes with zero errors on the scaffolded code.
4. Given a fresh install, when `pnpm run typecheck` is run from the repo root, then TypeScript strict-mode type checking passes with zero errors on both apps and all packages.
5. When a developer runs `pnpm run dev` from the repo root, then both apps start: `apps/web` is reachable at `http://localhost:3000` and `apps/api` is reachable at `http://localhost:3001` within 60 seconds.
6. A pre-commit hook runs ESLint + Prettier on staged files and blocks the commit if either fails.
7. The repo contains a root `README.md`, an `apps/web/README.md`, an `apps/api/README.md`, a `packages/shared/README.md`, and a `packages/ui/README.md`.

### 3.2 Next.js app (`apps/web`)

1. The Next.js app uses the App Router, TypeScript strict mode, and Tailwind CSS. Running `pnpm typecheck` in `apps/web` exits 0.
2. A placeholder home page at `/` renders without a runtime error in both `development` and after `pnpm build` (production build).
3. next-intl is configured with two locales: `es` (default) and `en`. The placeholder home page renders a translated string sourced from `messages/es.json` and `messages/en.json`. Both files exist and are non-empty. Visiting `/en` renders the English string; visiting `/` or `/es` renders the Spanish string.
4. CSP headers are present on every response from `apps/web` from day one (exact policy defined by architect ADR; the AC is that at least a restrictive default-src policy is returned in the `Content-Security-Policy` response header in production build).
5. The Vercel deployment for the `main` branch is live at a known URL. A successful production build deploys automatically on merge to `main` via Vercel's GitHub integration.

### 3.3 NestJS API (`apps/api`)

1. The NestJS app starts on port 3001. A `GET /api/health` endpoint returns `HTTP 200` with body `{"status":"ok"}`. This endpoint is public (no auth required) and is documented in Swagger.
2. Swagger UI is available at `GET /api/docs` in non-production environments. Accessing `/api/docs` returns `HTTP 200` with a valid OpenAPI JSON spec.
3. A global exception filter formats all unhandled errors as `{ "statusCode": N, "message": "...", "error": "..." }` — no raw NestJS stack traces exposed.
4. The NestJS app uses TypeScript strict mode. Running `pnpm typecheck` in `apps/api` exits 0.
5. The BE is deployed to the chosen hosting provider (Railway / Fly / Render — architect ADR required). A `GET {deployed-url}/api/health` returns `HTTP 200`. The deployment URL is recorded in the ClickUp ticket and in `docs/runbooks/deployments.md`.

### 3.4 Supabase & database

1. A Supabase project exists for the `dev` environment. Its connection string (non-secret reference) and project URL are stored in `apps/api/.env.example` and `apps/web/.env.example` as placeholder keys (e.g., `SUPABASE_URL=<your-supabase-url>`). No actual secrets are committed.
2. The Supabase CLI is configured in the repo (`supabase/config.toml` exists). Running `supabase status` locally shows the local instance is reachable when Docker is running.
3. The initial migration (`supabase/migrations/0001_initial.sql`) runs successfully against a clean Supabase instance (`supabase db reset` exits 0 locally).
4. The initial migration enables RLS on every table it creates (even if the initial schema has zero domain tables, the pattern is demonstrated with at least one example table — architect to determine if this is a `profiles` table or a stub). Row-level security is ON for every table as verified by `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — all rows return `rowsecurity = true`.
5. Supabase Auth is enabled with the magic-link (OTP) provider. Email provider is configured. No password auth is enabled.

### 3.5 Shared packages

1. `packages/shared` exports at least one Zod schema (a stub `healthResponseSchema` is sufficient) that is importable from both `apps/web` and `apps/api` without TypeScript errors.
2. `packages/ui` exists as a stub package with a `package.json`, `tsconfig.json`, and a placeholder `Button` component export. It is importable from `apps/web` without TypeScript errors.

### 3.6 CI pipeline (GitHub Actions)

1. A GitHub Actions workflow file exists at `.github/workflows/ci.yml`. On every push to any branch and every pull request targeting `main`, the workflow runs: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. All steps must exit 0 for the workflow to pass.
2. The CI workflow completes in under 10 minutes on a cold runner (no cache). With pnpm + Turborepo cache warmed, it completes in under 5 minutes.
3. Branch protection on `main` is configured in GitHub: requires the CI workflow to pass and at least 1 approving review before merge. Squash-merge is the only allowed merge strategy.
4. A dependency scanning step runs in CI (tool chosen by architect ADR). It produces a report; it does NOT fail the build on vulnerabilities in dev-only dependencies, but it DOES fail on high/critical vulnerabilities in production dependencies.

### 3.7 Definition of done for Foundation

The foundation is considered complete and ready for the next feature ticket when ALL of the following are true and verifiable by any agent or the human:

- [ ] `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test` exits 0 from a fresh clone.
- [ ] `http://localhost:3000` renders the Next.js placeholder page with a translated string.
- [ ] `http://localhost:3001/api/health` returns `{"status":"ok"}`.
- [ ] `http://localhost:3001/api/docs` returns Swagger UI.
- [ ] `supabase db reset` exits 0 locally and RLS is ON for all public tables.
- [ ] GitHub Actions CI workflow passes on the `main` branch.
- [ ] Vercel FE deployment is live at a known URL.
- [ ] BE deployment is live at a known URL (per architect ADR).
- [ ] Both `.env.example` files exist with all required keys documented (no secrets committed).
- [ ] `docs/runbooks/deployments.md` documents the deployed URLs and how to trigger a deploy.
* * *

## 4\. Out of scope

*   Any domain-specific tables, models, or API endpoints beyond the health check (those belong to feature-specific tickets).
*   Supabase `uat` and `prod` project provisioning (those happen when v1 is feature-complete and at launch respectively).
*   Stripe or payment integration (deferred sprint).
*   WhatsApp / Brevo integration setup (deferred to communications feature).
*   Customer-facing UI routes (all routes in v1 are studio-owner facing).
*   Figma component library or design system beyond Tailwind stub and `packages/ui` placeholder.
*   E2E test framework setup (that is the `qa` agent's concern on the first product feature ticket).
*   The `packages/ui` stub growing into a real component library (future ticket).
* * *

## 5\. Edge cases & error states

*   **Cold Supabase pause:** The Supabase free tier pauses the project after 7 days of inactivity. The first API request after a pause will fail. The architect must define a keep-alive strategy and document it in an ADR. This spec surfaces the requirement; the solution is the architect's.
*   **pnpm version mismatch:** The repo must pin a specific pnpm version via the `packageManager` field in `package.json` and in the CI workflow. Mismatched pnpm versions cause lockfile drift.
*   **Node version mismatch:** An `.nvmrc` or `.node-version` file must be present so developers and CI use the same Node version. CI must specify the same version explicitly.
*   **Secrets accidentally committed:** `.claude/settings.json` denies `.env*` reads at the agent level. A `.gitignore` entry must prevent `.env*` from being committed. A CI step (e.g., trufflehog or GitHub native scanning) should scan for committed secrets on every PR.
*   **Vercel preview vs. production env vars:** The Vercel project must have env vars for both `preview` and `production`. Document the required vars in `apps/web/.env.example` and the runbook.
*   **BE cold start on free-tier hosting:** Railway/Fly/Render free tiers may spin down containers after inactivity. Architect decides whether to ping or accept cold starts.
* * *

## 6\. Analytics & success metrics

**N/A for this feature.** Infrastructure foundation has no user-facing analytics surface — no events, no funnels, no behavior to measure. Success is binary: the Definition of Done in §3.7 is fully checked.

Operational metric worth noting: CI pass rate on `main` should be 100% after foundation merges. Any red CI on `main` is an incident.
* * *

## 7\. Roles & permissions

Not applicable in the traditional sense (no end-user permissions). However, the following access constraints apply:

*   **Supabase service-role key:** Used only in `apps/api` server-side. Never exposed to `apps/web`. Never committed.
*   **Supabase anon key:** Used in `apps/web` client-side. Safe to expose (protected by RLS). In `.env.example` as a documented placeholder.
*   **Vercel deployment secrets:** Managed via Vercel env var settings. Not in version control.
*   **BE hosting secrets:** Managed via that provider's secrets mechanism. Not in version control.
*   **GitHub Actions secrets:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, BE hosting deploy tokens — all configured as GitHub repository secrets and referenced via `${{ secrets.* }}`.

**RLS baseline convention:** Every table in `supabase/migrations/` must have `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` in the same migration that creates it. Enforced by code review (reviewer agent flags any table without it).
* * *

## 8\. Localization

next-intl is an invariant of the foundation, not an optional add-on. The scaffold must be wired such that all subsequent feature development inherits i18n from day one.

**Concrete requirement:** The placeholder home page must not contain any hardcoded user-facing strings. The string "Welcome to Massage Tulum" (or equivalent placeholder) must exist in both `messages/es.json` (key: `home.title`, value in Spanish) and `messages/en.json` (key: `home.title`, value in English), and must be rendered via `useTranslations('home')` or equivalent next-intl API.

No other localized strings are required at the foundation stage.
* * *

## 9\. Open questions for human review (GATE 1)

1. **BE hosting provider:** Railway, [Fly.io](http://Fly.io), or Render? The architect will write an ADR, but the human may have a preference (cost, familiarity, region) that should inform the ADR.
2. **Supabase keep-alive strategy:** The free tier pauses after 7 days. Plan: (a) accept and manually unpause, (b) configure scheduled ping, or (c) upgrade to Supabase Pro for development?
3. **Pre-commit hook tooling:** Husky (conventional) or alternative (e.g., Lefthook)?
4. **Dependency scanning tool:** [CLAUDE.md](http://CLAUDE.md) mentions "npm audit, Snyk free tier, or similar." Preference?
5. **Node version:** LTS 20.x or 22.x? Pin now to avoid cross-machine drift.
6. **pnpm version:** Pin in `package.json#packageManager`.
7. **Secrets scan in CI:** GitHub native (free for public repos), trufflehog, or other?
* * *

## 10\. Research needed

The following items should be investigated by the `researcher` agent before the `architect` writes ADRs:

1. **BE hosting comparison (Railway vs.** [**Fly.io**](http://Fly.io) **vs. Render):** free/low-cost tier limits, cold-start behavior, NestJS deployment compatibility, env vars/secrets support, region availability (latency to Tulum), gotchas with long-running Node processes. Produce a recommendation matrix.
2. **Supabase free-tier keep-alive strategies:** options to prevent the 7-day pause; lightweight scheduled-ping approaches that work within Vercel/GitHub Actions free tiers; what unpausing requires.
3. **GitHub Actions caching for pnpm + Turborepo monorepos:** recommended caching strategy (pnpm store + Turborepo remote cache) to get CI under 5 minutes; cache invalidation gotchas on lockfile changes.
4. **next-intl App Router setup (current pattern):** confirm the latest recommended setup with Next.js App Router; correct middleware + `i18n.ts` pattern for locale detection and `es`\-default routing.
5. **CSP headers in Next.js App Router:** current best practice for setting a restrictive CSP (middleware vs. `next.config.ts` headers vs. Vercel config); known issues with next-intl locale redirects + nonce strategies.
6. **Supabase CLI in GitHub Actions CI:** running `supabase db reset` and RLS policy tests in CI without a live project; local Docker-based test mode in GitHub Actions free runners.
* * *

## 11\. ADRs the architect must write before development starts

*   **ADR-0001:** BE hosting provider selection (blocks AC 3.17)
*   **ADR-0002:** Supabase project and environment strategy (dev/uat/prod, keep-alive)
*   **ADR-0003:** RLS baseline conventions (migration pattern, CI enforcement)
*   **ADR-0004:** CI pipeline shape and caching strategy (Turborepo remote cache, pnpm store)
*   **ADR-0005:** Dependency scanning tool selection
*   **ADR-0006:** CSP header strategy for Next.js App Router
* * *

## 12\. What is deliberately NOT in this spec (left to the architect)

*   Which BE hosting provider and its configuration
*   Exact CI workflow YAML structure and caching approach
*   Specific RLS policy templates
*   Exact CSP policy directives
*   Supabase project IDs, connection strings, or credentials of any kind
*   Pre-commit hook tool selection
*   Whether to use Turborepo remote cache and with which backend
*   Node/pnpm exact version numbers
