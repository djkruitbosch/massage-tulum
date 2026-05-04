# Research: Studio Owner Authentication — Five Pre-Architecture Questions

**Ticket:** CU-869d29f1f
**Date:** 2026-05-03
**Author:** researcher (agent)
**Requested by:** human (orchestrator session)
**Decision deadline:** Blocking — architect cannot start ADR(s) until resolved.

---

## Constraints (from CLAUDE.md / ADRs)

- Stack locked: Next.js 15 App Router on Vercel, NestJS on Hetzner/Coolify, Supabase Auth + Postgres, Brevo SMTP (free tier), next-intl i18n.
- Brevo free tier: 300 emails/day shared across all sends (marketing + transactional combined).
- Supabase free tier: dev project, pauses after 7 days of inactivity (mitigated by keep-alive per ADR-0002).
- i18n: Spanish (default, `/`) and English (`/en/`), both locales populated simultaneously, no hardcoded strings.
- Auth method: magic-link OTP only. No passwords, no OAuth.
- RLS mandatory on every table (ADR-0003).
- CSP via Next.js middleware using per-request nonce (ADR-0006). The auth middleware will be combined with intl and CSP middleware in one `middleware.ts`.
- No secrets in code or `.env*` files committed to git.
- Solo developer. Vercel preview deployments are for self-review + QA agent, not a team.
- `supabase/config.toml` already has a commented-out Brevo SMTP block that is nearly correct.

---

## R1 — Brevo SMTP + Supabase Auth: Exact Configuration

### SMTP credentials format

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` (STARTTLS; recommended over 465) |
| User | Your Brevo account login email (the email you registered with on Brevo) |
| Pass | An SMTP Key generated in Brevo Dashboard → SMTP & API → SMTP → Generate a new SMTP key. This is NOT your account password and NOT your API key. |

The existing `supabase/config.toml` commented-out block is correct in structure. The `BREVO_SMTP_PASS` env var must hold the SMTP Key (not the account password). The `BREVO_SMTP_USER` env var must hold the Brevo login email.

**`config.toml` block (local dev):**

```toml
[auth.email.smtp]
host = "smtp-relay.brevo.com"
port = 587
user = "env(BREVO_SMTP_USER)"
pass = "env(BREVO_SMTP_PASS)"
admin_email = "noreply@massage-tulum.com"
sender_name = "Massage Tulum"
```

**Important gotcha** documented in GitHub Discussion #22030: Authentication failures (`535 5.7.8`) are almost always caused by (a) using the API key instead of the SMTP key, (b) trailing whitespace in the host value, or (c) regenerating SMTP credentials without updating the env var. The Supabase Dashboard for the hosted project has the same fields under Authentication → Settings → SMTP Settings.

### Sender domain verification (SPF / DKIM / DMARC)

Domain authentication is **mandatory** as of February 2024 (Gmail/Yahoo requirement), with Microsoft enforcing similar standards from May 2025. Brevo enforces this for all senders.

What is required:
1. **Brevo verification code** — a TXT record proving domain ownership.
2. **DKIM** — two CNAME records (`mail._domainkey.massage-tulum.com` and `mail2._domainkey.massage-tulum.com`).
3. **DMARC** — a TXT record at `_dmarc.massage-tulum.com` with at minimum `v=DMARC1; p=none; rua=mailto:...`.
4. **SPF** — Brevo states a dedicated SPF record is not required because the envelope-from domain is handled by Brevo. If a custom SPF record exists for `massage-tulum.com`, add `include:spf.brevo.com`.

If DKIM is not configured, Brevo replaces the sending domain with `@brevosend.com` as a fallback. **Domain verification must be completed before go-live.** It can wait until the hosted dev project is in use; Inbucket (local dev email catcher) does not require it.

### Deliverability risk on free tier

Brevo free tier uses a **shared IP pool**. Magic-link emails are single-recipient, non-promotional, and triggered by user action — the lowest-risk category for spam classification. With proper DKIM/DMARC configured, transactional emails from Brevo reliably reach Gmail/Yahoo inboxes. Spam risk is low but non-zero. If early studio owners report magic links going to spam, mitigation is (1) confirm DKIM is correctly configured and (2) consider a dedicated IP (paid add-on — only warranted at scale).

**Recommended sender pattern:**
- From name: `Massage Tulum`
- From address: `noreply@massage-tulum.com`

**Note:** Brevo free-tier emails include a "Sent with Brevo" footer. Visible to recipients but acceptable for v1. Paid plans remove it.

### Cost ceiling

Per studio onboarding: ~2 emails (magic-link + welcome). Per login session: 1 magic-link email. At v1 with <10 studios logging in once per day: ~10 emails/day. The 300/day ceiling is not a concern until 150+ active studios logging in daily.

---

## R2 — Supabase Auth Bilingual Email Templates (ES + EN)

### Does Supabase natively support per-locale email templates?

**No.** Supabase Auth has a single email template per template type. There is no built-in "locale = es → use this template" routing. This is a long-standing feature request (GitHub Discussion #953 and Issue #80, open since 2022).

### What does work: Go template conditionals

Supabase's template engine uses **Go Templates**. The `{{ .Data }}` variable exposes `auth.users.user_metadata`. You can embed conditional logic in a single template:

```html
<!-- subject line in config.toml or Dashboard -->
subject = "{{ if eq .Data.locale \"es\" }}Tu enlace para acceder a Massage Tulum{{ else }}Your sign-in link for Massage Tulum{{ end }}"

<!-- body (HTML template file) -->
{{ if eq .Data.locale "es" }}
<p>Hola, haz clic en el enlace para acceder a tu cuenta de Massage Tulum...</p>
<a href="{{ .ConfirmationURL }}">Acceder →</a>
{{ else }}
<p>Hi, click the link below to sign in to your Massage Tulum account...</p>
<a href="{{ .ConfirmationURL }}">Sign in →</a>
{{ end }}
```

**Critical constraint:** `{{ .Data }}` reflects `user_metadata` already stored on the user record at the time the email is triggered. For an existing user requesting a magic link, that metadata must have been stored at signup time or updated beforehand.

### Does the `locale` parameter on `signInWithOtp` work?

**Yes, with caveats.** Pass data via `options.data`:

```typescript
await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: redirectTo,
    data: { locale: 'es' }
  }
})
```

`options.data` is merged into `user_metadata`. For an existing user, the data passed updates their `user_metadata` and becomes available as `{{ .Data.locale }}` in the template (Discussion #21227, accessed 2026-05-03).

**Subject line** also supports Go template conditionals.

### Limitations

- If `locale` is missing from `user_metadata`, template falls through to `else` (English).
- For self-signup flow (§11), the form submission does NOT create an `auth.users` row immediately. The welcome email sent on admin approval needs to set locale via the NestJS backend using service role key: `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { locale } } })` then send through Brevo.
- No locale-based template routing at the engine level — both locales live in one template file.

### Alternative: Send Email Hook (v2 path)

Supabase's **Send Email Hook** (`[auth.hooks.send_email]`) intercepts every auth email before sending and calls your endpoint. The hook payload includes `user.user_metadata` and `email_data`. Full programmatic control. Trade-offs: replaces Supabase's default delivery, adds a NestJS endpoint, known local-dev 500-error issue (Issue #29270). For v1 with 2 locales and 2 emails, the conditional template approach is simpler. The hook is the v2 migration path if complexity grows.

### Recommendation for R2

**Conditional Go template approach for v1.** Pass `{ locale: currentLocale }` in `options.data` on every `signInWithOtp` call. Author a single bilingual template per email type.

---

## R3 — Vercel Preview Redirect URL Handling for Supabase Auth

### Does Supabase support wildcard subdomains?

**Yes.** Supabase Auth's redirect URL allow-list supports wildcard patterns using Go's `filepath.Match` semantics, where separators are `.` and `/`. Supported wildcards:
- `*` — any sequence of non-separator characters
- `**` (globstar) — any sequence including separators
- `?` — any single non-separator character

### Recommended Vercel pattern

Per official Supabase docs (redirect-urls guide, accessed 2026-05-03), the Vercel preview wildcard:

```
https://*-<vercel-account-slug>.vercel.app/**
```

Replace `<vercel-account-slug>` with the actual account slug from Vercel Dashboard → Settings → General → Account Slug.

### Security caveats

1. **Scoped to your account slug.** Pattern `https://*.vercel.app/**` would match any Vercel deployment — **do not use it.** The account-slug-scoped pattern limits the blast radius.
2. **Preview-only, not production.** Production Site URL in Supabase Dashboard should be `https://massage-tulum.com` — exact, no wildcard.
3. **Auth callback URL must be explicitly passed** in `signInWithOtp({ options: { emailRedirectTo } })`. Supabase validates against the allow-list at send time.

### Recommended config for this project

**Option A (preferred):** Use a Vercel "stable preview alias" — a permanent URL that always points to the latest preview. Add only this URL to the Supabase allow-list. No wildcard needed.

**Option B (if no stable alias):** Add account-slug wildcard.

Dev allow-list:
```
http://localhost:3000/**
http://127.0.0.1:3000/**
https://<stable-preview-url>/**            # Option A
# OR
https://*-<vercel-account-slug>.vercel.app/**   # Option B
```

Production (separate Supabase project per ADR-0002): `https://massage-tulum.com` exact only.

---

## R4 — `signOut({ scope })` Actual Behavior in `@supabase/ssr`

### The three scopes

| Scope | Server-side effect | Client-side effect | `SIGNED_OUT` event? |
|---|---|---|---|
| `'global'` (default) | All refresh tokens for the user destroyed in DB | Session cleared from cookie/localStorage | Yes, on current device |
| `'local'` | Only current session's refresh token revoked | Session cleared from current cookie | Yes |
| `'others'` | All refresh tokens EXCEPT current session revoked | No local session change | **No** — not fired |

Confirmed from Supabase signout docs (accessed 2026-05-03).

### Access token caveat

**Refresh token revocation is immediate. Access token revocation is NOT.** Access tokens (JWTs) remain valid until their `exp` claim. With `jwt_expiry = 3600` (1 hour), a globally signed-out user on another device can still make authenticated requests for up to 1 hour using their existing access token. This is fundamental to stateless JWTs. The 1-hour expiry is appropriate for a non-financial studio management app.

### OQ-5 implementation detail

OQ-5 decision: local default + "log out of all devices" as secondary action.

**In `@supabase/ssr` with cookie-based sessions**, `signOut({ scope: 'local' })` clears the auth cookies on the current response. This must happen in a Server Action or Route Handler (not purely client-side). Recommended flow:

1. User clicks "Log out" — triggers a Server Action.
2. Server Action calls `supabase.auth.signOut({ scope: 'local' })` using `createServerClient`.
3. `@supabase/ssr` writes the cleared session back via `setAll` cookie handler.
4. Server Action redirects to `/login`.

Client-side-only call (`createBrowserClient`) may leave SSR in an inconsistent state. **Use a Server Action for signout.**

### Cookie clearing in middleware

Middleware does NOT need to handle signout — it only refreshes sessions on incoming requests. Signout cookie clearing is a write operation in a Server Action / Route Handler response.

---

## R5 — Supabase + Next.js App Router Session Pattern (Current as of 2026)

### Package status

`@supabase/ssr` is current and correct. Latest stable: **v0.10.2** (released April 9, 2026). Deprecated `@supabase/auth-helpers-nextjs` should not be used.

**API key naming (gradual migration):**
- New projects (post-July 2025) use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `sb_publishable_xxx` key format.
- Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works through late 2026.
- This project's Foundation phase used `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy). Architect to decide whether to migrate to new format now or defer.

### `getClaims` vs `getUser` vs `getSession`

| Method | Where to use | What it does | Network call? |
|---|---|---|---|
| `getSession()` | **Never in server code** | Returns session from cookie, no validation | No |
| `getClaims()` | Most server-side auth checks | Validates JWT signature against JWKS | No (cached JWKS) |
| `getUser()` | Server Components displaying user data; middleware token-refresh cycle | Calls Supabase Auth server, verifies session | Yes |

**For middleware specifically: use `getUser()`.** It triggers the token refresh and writes refreshed cookies back. `getClaims()` validates locally but doesn't trigger refresh. Official Supabase Next.js guide confirms this (Issue #39947 actively reconciling docs inconsistency).

### Pattern per context

Install:
```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

**Server Components / Route Handlers / Server Actions** — `utils/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()  // Next.js 15: async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Read-only in Server Components — middleware handles writes
          }
        },
      },
    }
  )
}
```

**Client Components** — `utils/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Middleware** — must combine with next-intl + CSP nonce per ADR-0006:
```typescript
// apps/web/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const pathnameWithoutLocale = pathname.replace(/^\/(en)/, '') || '/'

  if (pathnameWithoutLocale.startsWith('/dashboard') && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = pathname.startsWith('/en') ? '/en/login' : '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const intlResponse = intlMiddleware(request)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie)
  })
  intlResponse.headers.set('Content-Security-Policy', buildCsp(nonce))
  intlResponse.headers.set('x-nonce', nonce)
  return intlResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Auth callback** — `app/auth/callback/route.ts`:
```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      const locale = request.nextUrl.pathname.startsWith('/en') ? '/en' : ''
      return NextResponse.redirect(`${origin}${locale}${next}`)
    }
  }

  const locale = request.nextUrl.pathname.startsWith('/en') ? '/en' : ''
  return NextResponse.redirect(`${origin}${locale}/login?error=link_expired`)
}
```

**Magic link template uses `{{ .ConfirmationURL }}`** which Supabase constructs as `<site_url>/auth/callback?token_hash=...&type=email&next=...`. The `next` param is set from `emailRedirectTo`. Developer must ensure `emailRedirectTo` points to `/auth/callback`.

### Next.js 15 cookie API

`cookies()` is async. Use `await cookies()` everywhere. Do not copy pre-Next.js-15 examples.

### ADR-0006 integration

Middleware combines: CSP nonce + i18n routing + Supabase session refresh. Ordering: Supabase refresh → route protection → intl middleware → apply CSP + auth cookies to intl response.

---

## Recommendations Summary (Architect Inputs)

**R1 — Brevo SMTP:** `smtp-relay.brevo.com:587`, user = Brevo login email, pass = SMTP Key (not API key). The `config.toml` stub is correct — uncomment and populate env vars. Domain verification (Brevo code + DKIM + DMARC) on `massage-tulum.com` mandatory before go-live; add to deployment runbook. Free tier sufficient for v1 volumes.

**R2 — Bilingual templates:** Single Go-template with `{{ if eq .Data.locale "es" }}` conditional. Pass `options.data: { locale }` on every `signInWithOtp` call. Subject line supports conditionals too. Send Email Hook is the v2 migration path. For admin-approval welcome email (sent via NestJS), use `supabase.auth.admin.generateLink()` with service role key to generate the link and pass locale in `options.data`, then send via Brevo.

**R3 — Vercel preview redirects:** Use single stable Vercel alias URL (cleanest) OR `https://*-<vercel-account-slug>.vercel.app/**` wildcard. Never bare `*.vercel.app`. Production uses exact URL only.

**R4 — signOut scope:** OQ-5 confirmed correct. Local default. Implement signout as a Server Action. Global revokes refresh tokens immediately; access tokens live up to 1 hour post-revocation (acceptable).

**R5 — Session pattern:** `@supabase/ssr` v0.10.2. Use `getUser()` in middleware (not `getClaims()`) for token-refresh cookie write. `await cookies()` (Next.js 15 async). Auth callback uses `verifyOtp({ token_hash, type })`. Combined middleware ordering: Supabase refresh → route protection → intl → CSP+cookies. Project currently uses legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` — architect to decide whether to migrate to `sb_publishable_xxx` now or defer (legacy works through late 2026).

---

## Risks and Unresolved Items

1. **`getUser()` vs `getClaims()` in middleware — docs inconsistency.** Canonical guide uses `getUser()` in middleware for cookie refresh; `getClaims()` validates locally but doesn't trigger refresh. Use `getUser()`. Performance cost: one network call per middleware invocation on protected routes.

2. **Combined middleware ordering.** Supabase + next-intl + CSP nonce in one `middleware.ts`. Ordering above (Supabase refresh first, then intl redirect, then headers) needs validation in implementation. Developer should test that locale redirects from next-intl preserve auth cookies.

3. **API key format.** Project uses legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Works through late 2026. Architect to decide migrate-now vs defer.

4. **Send Email Hook for welcome email (admin approval flow).** NestJS backend must call `supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { locale } } })` with service role key, then send via Brevo. Architect to specify whether NestJS calls Brevo directly (HTTP API) or via SMTP.

5. **Brevo "Sent with Brevo" footer** on free tier emails. Visible to recipients. Acceptable for v1; flag in onboarding runbook.

6. **`max_frequency` for production.** Currently `"1s"` in `config.toml`. Spec AC-5 wants ~60s. Architect to specify production value (recommendation: `"60s"`).

---

## Sources

1. [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) — accessed 2026-05-03
2. [Setting Brevo SMTP on Supabase · Discussion #22030](https://github.com/orgs/supabase/discussions/22030) — accessed 2026-05-03
3. [Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config) — accessed 2026-05-03
4. [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) — accessed 2026-05-03
5. [Customizing email templates (local)](https://supabase.com/docs/guides/local-development/customizing-email-templates) — accessed 2026-05-03
6. [Customizing Emails by Language · Discussion #21227](https://github.com/orgs/supabase/discussions/21227) — accessed 2026-05-03
7. [i18n Email Template Feature Request · Discussion #953](https://github.com/orgs/supabase/discussions/953) — accessed 2026-05-03
8. [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) — accessed 2026-05-03
9. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) — accessed 2026-05-03
10. [Vercel preview + Supabase auth · Discussion #2760](https://github.com/orgs/supabase/discussions/2760) — accessed 2026-05-03
11. [Signing out](https://supabase.com/docs/guides/auth/signout) — accessed 2026-05-03
12. [JS API Reference: signOut](https://supabase.com/docs/reference/javascript/auth-signout) — accessed 2026-05-03
13. [auth-js Issue #201](https://github.com/supabase/auth-js/issues/201) — accessed 2026-05-03
14. [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — accessed 2026-05-03
15. [Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — accessed 2026-05-03
16. [@supabase/ssr releases](https://github.com/supabase/ssr/releases) — accessed 2026-05-03
17. [API Keys migration · Discussion #29260](https://github.com/orgs/supabase/discussions/29260) — accessed 2026-05-03
18. [SSR getClaims vs getUser · Issue #39947](https://github.com/supabase/supabase/issues/39947) — accessed 2026-05-03
19. [Clarify getClaims/getUser/getSession · Issue #40985](https://github.com/supabase/supabase/issues/40985) — accessed 2026-05-03
20. [Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) — accessed 2026-05-03
21. [Brevo SMTP integration](https://developers.brevo.com/docs/smtp-integration) — accessed 2026-05-03
22. [Brevo domain authentication](https://help.brevo.com/hc/en-us/articles/12163873383186) — accessed 2026-05-03
23. [Brevo SMTP port guidance](https://help.brevo.com/hc/en-us/articles/10905415650322) — accessed 2026-05-03
