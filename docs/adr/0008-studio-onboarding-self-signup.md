# ADR 0008: Studio Owner Self-Signup and Admin Approval Flow

**Status:** Accepted
**Date:** 2026-05-03
**Author:** architect (agent)
**Context tickets:** CU-869d29f1f

## Context

Spec §11 (expanded at GATE 1) introduces a self-signup flow: studio owners submit a public form, land in a `pending_studios` holding table, and are approved or rejected by the platform admin. On approval, `studios` and `studio_profiles` rows are created and a welcome email with a magic-link is sent.

This ADR resolves four decisions the researcher flagged as unresolved:

1. **Anti-abuse mechanism for the public `/signup` endpoint** — the spec says "rate-limit by IP; architect to choose: NestJS endpoint vs. direct Supabase write".
2. **Welcome email transport** — NestJS calls Brevo how? Via SMTP, HTTP API, or `supabase.auth.admin.generateLink()` + Brevo?
3. **Admin authentication mechanism** — hardcoded admin emails env var vs. boolean column on `studio_profiles` vs. separate `admins` table.
4. **`pending_studios` RLS model** — anon can `INSERT`, admin can `SELECT`/`UPDATE`, nobody can `DELETE`, studio owners cannot enumerate their own pending row.

Forces at play:

- The self-signup form is public (no auth required). Direct Supabase writes from the frontend with `INSERT` permission on `pending_studios` would bypass the rate-limit entirely.
- The admin panel (`/admin/pending-studios`) is only used by the platform operator (one person for v1). Complexity must be proportional.
- Brevo SMTP is already configured for Supabase Auth (ADR-0007). The NestJS backend will need to send a welcome email that includes a magic-link; `supabase.auth.admin.generateLink()` is the only way to generate a magic-link token from server-side code.
- The `pending_studios` table must not expose submitted emails to unauthenticated callers (no enumeration).
- ADR-0003 (RLS baseline) applies: RLS must be enabled in the same migration that creates the table; pgTAP 4-case test required.
- The admin is a Supabase-authenticated user (they log in via magic-link like any studio owner). Admin status is a platform concept, not a Supabase Auth concept.

## Decision

### 1. Anti-abuse: NestJS endpoint with @nestjs/throttler

The `/signup` form submission routes through a **NestJS endpoint** (`POST /api/studios/signup`) rather than writing directly to Supabase from the Next.js frontend. The NestJS endpoint uses `@nestjs/throttler` for IP-based rate limiting.

**Rate limit configuration:**

```
TTL: 60 seconds
Limit: 3 requests per IP per TTL window
```

Three attempts in 60 seconds is generous enough to allow retries for network errors but tight enough to prevent automated submission floods.

The Next.js frontend (`/signup` page) calls the NestJS endpoint via a Server Action. This keeps the Supabase service-role key on the NestJS side (the endpoint uses service-role to insert into `pending_studios` since the anon key would require an INSERT policy that's harder to constrain server-side).

**Why not direct Supabase write from Next.js frontend?**

With a direct write, the only rate-limiting available is Supabase Auth's own limits (which apply to auth operations, not arbitrary table inserts). A determined attacker could flood `pending_studios` with thousands of rows directly via the Supabase REST API using the anon key (which is public). Routing through NestJS allows per-IP throttling at the HTTP layer before any DB write occurs.

**Supabase RLS on `pending_studios`** is still applied as defense-in-depth (see §4 below), but the primary anti-abuse layer is the NestJS throttler.

### 2. Welcome email transport: `generateLink()` + Brevo HTTP API

When the admin approves a studio, the NestJS approval endpoint:

1. Calls `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { locale } } })` using the service-role key to create a magic-link token.
2. Sends the welcome email via **Brevo HTTP API** (not SMTP) using the Brevo API key stored in NestJS environment variables.

**Why Brevo HTTP API (not SMTP) for welcome email?**

SMTP is configured in `supabase/config.toml` and is used by Supabase Auth's own email dispatch (magic-link request emails). For programmatic email sending from NestJS — where we need full control over the template, recipient, and content — the Brevo HTTP API (`POST https://api.brevo.com/v3/smtp/email`) is more appropriate:

- Full template control without depending on Supabase's template rendering.
- Response includes a message ID for logging (without logging PII).
- No SMTP connection management in NestJS.
- The Brevo API key is a different credential from the SMTP key; it can be scoped to transactional email only.

**Why not use Supabase Auth's built-in welcome email dispatch?**

Supabase's `admin.generateLink()` generates a link but does NOT send an email. The transport is always NestJS's responsibility in the admin-approval flow. This gives full control over when the email is sent (atomically within the approval transaction, not as a side effect of Auth).

**Email content:** The welcome email is a custom HTML template built in NestJS (not a Supabase Go-template). It contains the magic-link generated by `generateLink()`. The link expires after 1 hour per `otp_expiry = 3600` in `config.toml`. The NestJS template handles bilingual content via the `locale` field stored in `pending_studios`.

### 3. Admin authentication mechanism: env-var allowlist

Identify the admin by a **`ADMIN_EMAILS` environment variable** on the NestJS API — a comma-separated list of email addresses. Example: `ADMIN_EMAILS=dirk-jan@dirk-jan.com`.

The NestJS admin guard reads `supabase.auth.admin.getUserById(userId)` (or validates the JWT from the `Authorization` header) and checks whether the authenticated user's email is in the `ADMIN_EMAILS` list.

The `/admin/*` Next.js routes perform the same check server-side using the session from cookies.

**Why not a boolean column on `studio_profiles`?**

A boolean column requires a `studio_profiles` row to exist first (chicken-and-egg: the admin does not have a studio profile since they are not a studio owner). It also mixes two distinct concepts (studio ownership and platform administration) into one table, and would need RLS exceptions that complicate the studio-owner-only access model.

**Why not a separate `admins` table?**

Separate table is the correct long-term solution and is the natural migration path. However, for v1 with a single admin (the platform operator), it adds a migration, RLS policy, and test overhead that is not justified. The env-var allowlist is trivially replaceable with a table in a future ADR when multi-admin support is needed.

**Security note:** The `ADMIN_EMAILS` env var is stored in Coolify (never committed). An admin must be a valid Supabase Auth user (they authenticate via magic-link first). Being in `ADMIN_EMAILS` without a valid session grants nothing — the NestJS guard always validates the JWT before checking the allowlist.

**Admin route protection in Next.js:**

The `/admin/*` routes return a 404 (not a 403) for non-admin authenticated users and for unauthenticated requests (AC-22 from spec). This is enforced in the dashboard layout/middleware by checking admin status and returning `notFound()` if the check fails.

### 4. `pending_studios` RLS policy model

RLS is enabled on `pending_studios`. The policy model:

| Operation | Allowed? | Policy |
|---|---|---|
| `SELECT` | Admin only | `auth.email() = ANY(string_to_array(current_setting('app.admin_emails', true), ','))` |
| `INSERT` | Via NestJS service-role only | Effectively blocked via API (service-role bypasses RLS; anon INSERT policy is absent) |
| `UPDATE` | Admin only | Same admin check as SELECT |
| `DELETE` | Nobody | No DELETE policy defined |

**INSERT via service-role:** The NestJS endpoint uses the service-role Supabase client to insert `pending_studios` rows. This bypasses RLS, meaning no explicit INSERT policy is needed. Anon INSERT is therefore blocked by default (RLS enabled + no matching policy = deny).

**`app.admin_emails` session variable:** The admin email check in RLS uses `current_setting('app.admin_emails', true)` — a Postgres session variable set by NestJS at the start of each admin request using `SET LOCAL app.admin_emails = '...'`. This avoids hardcoding emails in the database and keeps them in the application layer (env var).

**Alternative considered and rejected:** Using a separate `admins` table in RLS (`EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())`). Rejected for v1 — the table does not exist yet and the env-var pattern is sufficient.

**pgTAP test file:** `supabase/tests/rls_pending_studios_test.sql` — 4 minimum cases per ADR-0003:

1. `anon-insert-blocked`: anon role cannot INSERT (service-role is the only insert path).
2. `anon-read-blocked`: anon role SELECT returns empty.
3. `non-admin-read-blocked`: authenticated non-admin user SELECT returns empty.
4. `admin-read-allowed`: authenticated admin user (with `app.admin_emails` set) can SELECT pending rows.

### 5. Atomic approval action

The NestJS approval endpoint executes the following steps within a single Postgres transaction (using the service-role client):

1. `INSERT INTO public.studios (name, ...) VALUES (...) RETURNING id`.
2. `INSERT INTO public.studio_profiles (id, studio_id) VALUES (auth_user_id, studio_id)` — but `auth_user_id` may not exist yet if the studio owner has never logged in. Resolution: `supabase.auth.admin.getUserByEmail(email)` before the transaction; if no user exists, `supabase.auth.admin.createUser({ email, email_confirm: true })` first, then use the returned `id`.
3. `UPDATE public.pending_studios SET status = 'approved', reviewed_at = now(), reviewed_by = admin_user_id WHERE id = pending_id`.
4. Call `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { locale } } })` — outside the transaction (Supabase Auth is not transactional with Postgres).
5. Send welcome email via Brevo HTTP API with the generated link.
6. Return success to the admin UI.

If step 1–3 succeed but step 5 fails (Brevo unavailable), the studio rows exist but no welcome email was sent. The admin can resend from the UI (resend action: generates a new magic-link and sends the welcome email again). This is acceptable at v1 — atomicity covers the data write; email delivery is best-effort.

### 6. Rejection action

Simpler: `UPDATE public.pending_studios SET status = 'rejected', rejection_reason = ..., reviewed_at = now(), reviewed_by = admin_user_id WHERE id = pending_id`. No email sent (silent rejection in v1 per spec §11).

### 7. `pending_studios` schema additions beyond the spec

The spec §11 defines the table. Two additions for the admin approval flow:

- `locale` (text, nullable, default `'en'`) — stores the UI locale at form submission time. Used to send bilingual welcome email.
- `auth_user_id` (uuid, nullable, references `auth.users(id)`) — populated when an `auth.users` row is created for the applicant during approval. Nullable because approval creates the user.

## Consequences

- **Positive:**
  - NestJS throttler prevents `pending_studios` flooding with no RLS complexity.
  - Brevo HTTP API gives full control over welcome email content and timing.
  - Env-var admin allowlist is the simplest mechanism that works for v1.
  - Atomic approval transaction ensures no half-created studio state.

- **Negative:**
  - NestJS is now in the signup critical path (an outage blocks new signups). Acceptable — the NestJS API is the backend for the whole platform; any signup during an API outage is edge-case.
  - `app.admin_emails` session variable in RLS is a non-standard pattern. Developer must set it correctly in NestJS middleware. Mitigated by convention and tests.
  - Brevo HTTP API key is a new credential to manage (separate from the SMTP key used by Supabase Auth).

- **Neutral / follow-up work:**
  - Future ADR when multi-admin support needed: replace `ADMIN_EMAILS` env var with `public.admins` table.
  - Resend welcome email action in admin UI (not scoped to this ticket but flagged).
  - `pending_studios.locale` and `pending_studios.auth_user_id` columns added to migration.

## Alternatives considered

**Direct Supabase write from Next.js for signup (no NestJS):**
Rejected. No IP rate limiting available for arbitrary table inserts via the Supabase REST API with the anon key. An attacker can flood the table from any IP. The NestJS throttler is the only practical anti-abuse layer.

**Brevo SMTP for welcome email (from NestJS):**
Rejected. SMTP connection management from NestJS adds a dependency on the Supabase-configured SMTP relay (`smtp-relay.brevo.com`). For programmatic email from NestJS, the HTTP API is cleaner: no connection pooling, no STARTTLS handshake, better error observability. The SMTP configuration in `config.toml` is for Supabase Auth's own email dispatch and should remain dedicated to that purpose.

**`supabase.auth.admin.inviteUserByEmail()` instead of `generateLink()`:**
Rejected. `inviteUserByEmail` sends its own email via Supabase (bypassing our Brevo template). We need full control over the email content (bilingual welcome template, not Supabase's default invite template).

**Boolean `is_admin` column on `studio_profiles`:**
Rejected. Admin users (platform operators) are not studio owners. Conflating the two in one table creates an inconsistent data model and complicates RLS on `studio_profiles` (which is supposed to be readable only by the owner). A column on a table the user does not even have does not make semantic sense.

**Separate `admins` table:**
Deferred (not rejected). Correct long-term solution. Not justified for v1 with one admin. Migration path is clear.

## Implementation notes

**New NestJS module:** `apps/api/src/studios/` with:
- `studios.module.ts`
- `studios.controller.ts` — `POST /api/studios/signup` (public, throttled), `GET /api/admin/pending-studios` (admin guard), `POST /api/admin/pending-studios/:id/approve` (admin guard), `POST /api/admin/pending-studios/:id/reject` (admin guard)
- `studios.service.ts`
- `dto/create-pending-studio.dto.ts`
- `dto/approve-studio.dto.ts`
- `dto/reject-studio.dto.ts`
- `guards/admin.guard.ts` — validates JWT then checks `ADMIN_EMAILS` env var

**Throttler config in `AppModule`:**
```
ThrottlerModule.forRoot([{ ttl: 60000, limit: 3 }])
```
Apply `@Throttle({ default: { ttl: 60000, limit: 3 } })` to the signup endpoint only (admin endpoints are protected by auth, not throttled by IP).

**Environment variables (new):**
- `SUPABASE_URL` — already in `.env.example` (marked "future" in Foundation; now active)
- `SUPABASE_SERVICE_ROLE_KEY` — already in `.env.example` (now active)
- `ADMIN_EMAILS` — comma-separated admin email list (new, NestJS only)
- `BREVO_API_KEY` — Brevo API key for programmatic email (new, NestJS only; different from Supabase's `BREVO_SMTP_PASS`)

**Migration files (one concern each):**
1. `create_pending_studios` — table + RLS + `pending_studio_status` enum
2. `create_studios` — table + RLS
3. `create_studio_profiles` — table + RLS + FK to `studios` and `auth.users`

**pgTAP test files:**
- `supabase/tests/rls_pending_studios_test.sql`
- `supabase/tests/rls_studios_test.sql`
- `supabase/tests/rls_studio_profiles_test.sql`

**Rollback plan:**
Migration rollback: `pending_studios` is standalone. `studios` and `studio_profiles` can be dropped without affecting other tables (no other feature depends on them at this stage). Standard `DROP TABLE IF EXISTS` in a corrective migration.
