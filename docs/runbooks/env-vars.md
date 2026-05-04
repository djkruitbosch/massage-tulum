# Environment Variables Reference

**Last updated:** 2026-05-03
**Owner:** developer-devops (agent)

This is the canonical list of all environment variables used across the Massage Tulum platform. Update this file whenever a new variable is added or an existing one is changed.

Variables are loaded from the hosting platform's secret store — never from `.env*` files in CI. See `apps/api/.env.example` for local development documentation.

---

## Backend (NestJS API — Coolify)

| Variable | Required | Description | Where to get it |
|----------|----------|-------------|-----------------|
| `SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xyzxyz.supabase.co`) | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — server-side only, bypasses RLS. **Never expose to frontend.** | Supabase Dashboard → Settings → API → service_role |
| `PORT` | No | Port NestJS listens on. Defaults to `3001` (ADR-0001). | Set to `3001` or leave unset |
| `NODE_ENV` | No | Runtime environment. Set to `production` in hosted envs. | `production` / `development` |
| `BREVO_SMTP_USER` | Yes (hosted) | Brevo login email. Used by Supabase Auth SMTP config. | Brevo Dashboard → SMTP & API → SMTP → Login |
| `BREVO_SMTP_PASS` | Yes (hosted) | Brevo SMTP key. NOT the account password, NOT the API key. | Brevo Dashboard → SMTP & API → SMTP → SMTP key |
| `BREVO_API_KEY` | Yes (hosted) | Brevo HTTP API key for NestJS programmatic email send. | Brevo Dashboard → SMTP & API → API Keys |
| `ADMIN_EMAILS` | Yes (hosted) | Comma-separated platform admin email addresses. | Set manually per environment |

---

## Frontend (Next.js — Vercel)

| Variable | Required | Description | Where to get it |
|----------|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL — safe for browser. | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key — safe for browser. | Supabase Dashboard → Settings → API → anon |

---

## GitHub Actions (CI)

| Variable / Secret | Used in | Description |
|-------------------|---------|-------------|
| `SUPABASE_URL` | keep-alive workflow, CI RLS tests | Dev project URL |
| `SUPABASE_ANON_KEY` | keep-alive workflow | Anon key for keep-alive ping |

---

## Local development

For local development, copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local` and fill in values from your local Supabase CLI stack (`supabase start` prints all local credentials).

**Local Supabase CLI environment variables** (printed by `supabase start`, not committed):

| Variable | Value source |
|----------|--------------|
| `SUPABASE_URL` | `http://127.0.0.1:54321` (local) |
| `SUPABASE_SERVICE_ROLE_KEY` | Printed by `supabase start` |
| `SUPABASE_ANON_KEY` | Printed by `supabase start` |

For local dev, `BREVO_SMTP_USER` and `BREVO_SMTP_PASS` are not required — email is captured by Inbucket at `http://localhost:54324`.

---

## Adding a new variable

1. Add the variable to `apps/api/.env.example` (or `apps/web/.env.example`) with a placeholder value and explanatory comment.
2. Add the variable to this file in the appropriate table.
3. Add the variable to the Coolify service (backend) or Vercel project (frontend) secret store.
4. For GitHub Actions, add as a repository secret if needed.
5. Open a PR. The reviewer checks that no real secret values are committed.
