# Spec: Studio Owner Authentication (Login, Logout, Session)

**Ticket:** CU-869d29f1f
**Status:** Approved (GATE 1 — 2026-05-03)
**Author:** product-manager (agent)
**Date:** 2026-05-03
**Roadmap reference:** v1 Roadmap (2026-04-26) — Feature 1, P0

---

## 0. Decisions locked at GATE 1 (2026-05-03)

The following decisions resolve the open questions in §9 and are now binding inputs to architect, designer, and developer agents.

| OQ | Decision |
|---|---|
| **OQ-1** | Use a single stable Vercel preview alias (or a custom dev subdomain) for the auth callback redirect URL. Architect to pick the exact mechanism in the ADR. Add `localhost` + the chosen stable URL to Supabase's redirect allow-list. Per-PR preview URLs are not added to the allow-list. |
| **OQ-2** | Maximum refresh token lifetime: **1 week** (Supabase default). Access token JWT expiry stays at 1 hour with silent refresh. |
| **OQ-3 + OQ-4** | **Self-signup with admin approval gate.** Studio owners self-register via a public signup form. New signups land in a `pending_studios` table. The platform admin (you) reviews and approves from an admin UI; on approval, `studios` and `studio_profiles` rows are created and the user can log in to the dashboard. Pre-approval logins fail closed (RLS returns no studio data; user sees a "pending approval" state). `enable_signup` stays `true`. **This expands scope** — see §11 below. |
| **OQ-5** | **Local logout by default.** A secondary "Log out of all devices" action in the user menu invokes `signOut({ scope: 'global' })`. Designer to spec the menu structure. |
| **OQ-6** | The `/dashboard` post-login stub is **in scope** for this ticket. Stub content: studio name + logout button. Real dashboard content is a separate feature. |
| **OQ-7** | Routed to researcher (R2) — bilingual Supabase Auth email template mechanism. |

---

## 1. Problem

A studio owner in Tulum needs a secure way to access the platform to manage their
bookings, services, and therapists. Without authentication, no studio management
feature can exist. Without a working logout, a shared device (front desk tablet or
laptop) becomes a security liability.

The studio owner will log in once per session on their device — typically a laptop or
desktop. They will log out at end of day or when handing the device to someone else.
This happens every working day, so the authentication experience must be frictionless
and the session persistence must be appropriate for a professional work context.

**Why magic link only:** Passwords introduce forgotten-password recovery flows, breach
vectors, and support burden. Magic-link email OTP removes all of these at the cost of
email deliverability latency (seconds). For v1 with a handful of studios, that tradeoff
is correct. Decision is locked (2026-04-26, confirmed in ticket CU-869d29f1f).

**Who has this problem:** Every studio owner using the platform. In dev, this means the
one Tulum studio being onboarded. At v1 launch, every studio on the platform.

---

## 2. User stories

- As a studio owner, I want to enter my email address and receive a login link, so that
  I can access the platform without managing a password.
- As a studio owner, I want to click the magic link in my email and be taken directly
  into the studio dashboard, so that the login experience requires no extra steps.
- As a studio owner, I want to stay logged in across browser tabs and short sessions
  (same day), so that I do not have to re-authenticate every time I switch tabs.
- As a studio owner, I want to log out of the platform, so that my account is not
  accessible to anyone who uses the same device after me.
- As a studio owner, I want clear, translated feedback when I request a login link (in
  Spanish or English depending on my browser preference), so that I know what to expect
  next.

---

## 3. Acceptance criteria

### Magic-link request flow

1. Given the user is unauthenticated, when they navigate to `/login` (Spanish default)
   or `/en/login`, then they see a single-field form with an email input and a submit
   button, with all copy in the correct locale.

2. Given the login form is rendered, when the user submits a valid email address, then:
   a. The UI enters a loading/sent state within 300ms.
   b. A success message is displayed telling the user to check their email (copy comes
      from `toast.success.loginLink` translation keys).
   c. A magic-link email is dispatched via Brevo SMTP within 30 seconds.
   d. The submit button is disabled and the email field is read-only until the user
      explicitly requests to re-enter their email or the page is refreshed.

3. Given the login form is submitted with an empty or malformed email address, when
   validation fires (on submit, not on blur), then an inline error message is displayed
   below the field in the correct locale and the form is NOT submitted.

4. Given a magic-link email is dispatched, when the user clicks the link in the email,
   then:
   a. The user is redirected to `/dashboard` (Spanish) or `/en/dashboard` (English),
      preserving locale.
   b. The session is established in the browser (access token + refresh token stored by
      the Supabase JS client).
   c. The user does NOT see the login page again; they are on the dashboard stub.

5. Given a magic-link has already been sent, when the user submits the form again within
   1 minute, then the UI displays a rate-limit message (copy from
   `auth.login.rateLimitMessage`) and does NOT dispatch a second email during that
   window. (Supabase's `max_frequency` governs the actual email gate; the FE should
   reflect the expected wait time.)

6. Given an authenticated user navigates to `/login`, then they are immediately
   redirected to `/dashboard` (no login form shown).

### Auth callback

7. Given a magic link is clicked by the user, when Supabase processes the OTP and
   redirects to the app's auth callback route, then:
   a. The callback route (`/auth/callback`) exchanges the token/code and establishes the
      session.
   b. On success, the user is redirected to `/dashboard`.
   c. On failure (expired link, already-used link, invalid token), the user is redirected
      to `/login?error=link_expired` and a localized error toast is displayed.

8. Given a magic link older than 1 hour is clicked, then the callback route handles the
   expired OTP error gracefully and redirects to `/login?error=link_expired` with a
   localized message (copy from `auth.callback.errors.linkExpired`).

### Session & refresh

9. Given an authenticated user has a valid session, when they remain active (making
   requests), then the Supabase JS client silently refreshes the access token before
   expiry. The user never sees an unexpected logout.

10. Given an authenticated user's refresh token has expired (session abandoned for the
    full refresh token lifetime), when they return to any protected route, then they are
    redirected to `/login` with no error (the session simply ended).

### Logout

11. Given an authenticated user is on any page, when they click the logout button (in
    the header nav), then:
    a. The client-side session is cleared (Supabase `signOut()` called).
    b. The refresh token is revoked server-side (Supabase `signOut({ scope: 'global' })`
       or equivalent — see open question OQ-5).
    c. The user is redirected to `/login` within 500ms.
    d. The back-button after logout does NOT display authenticated page content
       (protected pages recheck auth server-side).

12. Given a user is logged in on multiple tabs, when they log out in one tab, then the
    other tabs reflect the logged-out state within the next navigation or page focus
    (exact cross-tab propagation behavior depends on Supabase's session storage
    mechanism — architect to confirm).

### Route protection

13. Given an unauthenticated user attempts to navigate to any route under `/dashboard`
    (or any other protected prefix established in this spec), then they are redirected to
    `/login` with the original path preserved as a `?next=` query parameter so they can
    be sent there after login.

14. Given an authenticated user's JWT is verified server-side (via middleware or Server
    Component), when the JWT is invalid or absent, then they are redirected to `/login`.

### Data model

15. Given a new studio owner completes their first magic-link login (first time ever),
    then a `studio_profiles` row is created (or verified to exist) that links
    `auth.users.id` to a `studios` row. The exact creation mechanism (pre-seeded by
    admin vs. auto-created on first login) is an open question (OQ-4) — but the row
    must exist for any subsequent feature to function.

16. Given the `studio_profiles` and `studios` tables exist, then RLS policies must
    ensure:
    a. A studio owner can only SELECT/UPDATE their own `studio_profiles` row.
    b. A studio owner can only SELECT/UPDATE their own `studios` row.
    c. Anonymous role has no access to either table (SELECT, INSERT, UPDATE, DELETE all
       blocked).
    d. Cross-owner reads are blocked (owner A cannot read owner B's studio data).

### Email

17. Given a magic-link email is sent, then it is sent via Brevo SMTP (not Supabase's
    default SMTP) and the sender name and address are configured to a Massage Tulum
    address (e.g., `noreply@massage-tulum.com`).

18. Given the studio owner has their browser/OS set to Spanish, then the magic-link
    email body and subject line are in Spanish. Given English locale, the email is in
    English. (Supabase Auth supports custom email templates per locale — architect to
    confirm the exact mechanism, but the requirement is bilingual emails from day one.)

### Accessibility

19. Given the login form is rendered, then:
    a. The email input has a visible label (not placeholder-only).
    b. Inline validation errors are associated with the input via `aria-describedby`.
    c. The submit button state (loading, disabled) is communicated to screen readers via
       `aria-busy` and `aria-disabled`.
    d. The form is fully operable by keyboard alone (tab order, enter to submit).
    e. Focus is managed after form submission: moved to the success message or error
       message as appropriate.

---

## 4. Out of scope

- **Password-based login.** Decision locked. No password input, no forgot-password
  link, no password-reset flow. Ever, in this spec.
- **OAuth / social login** (Google, Apple, etc.). Not in v1.
- **Multi-user per studio.** In v1, one account owns one studio. Invitations,
  role management, and team access are v2 features.
- **Customer authentication.** Customers booking services will have their own auth
  flow in a later sprint. This spec only covers studio owners.
- **Email change flow.** Studio owner cannot change their login email in v1.
- **Account deletion.** Out of scope for v1.
- **Admin panel / user management.** Platform admins managing studios is out of scope
  for this spec. Manual intervention is via Supabase Dashboard in v1.
- **Two-factor authentication (2FA).** Magic link already is a second factor; TOTP or
  SMS 2FA are not in scope.
- **Rate limiting at the NestJS API layer.** The auth flow in v1 does not route through
  the NestJS API — it uses Supabase Auth directly from the frontend. API-layer rate
  limiting is a separate concern.
- **PKCE / advanced OAuth flows.** Supabase handles PKCE for the magic link internally;
  no custom implementation is required by this spec.
- **The dashboard page itself.** This spec requires a `/dashboard` stub route to exist
  as a post-login landing page, but the content and design of the dashboard are a
  separate feature.

---

## 5. Edge cases & error states

### Email input

- **Empty email submitted:** Inline validation error, no API call fired.
  Copy key: `auth.login.errors.emailRequired`.
- **Malformed email submitted** (missing `@`, missing TLD): Inline validation error.
  Copy key: `auth.login.errors.emailInvalid`.
- **Very long email (>254 chars):** Treated as malformed. Same copy key.

### Magic link delivery

- **Supabase rate limit hit** (second request within `max_frequency` window, currently 1s
  in dev config — should be raised to ~60s for prod): Supabase returns a 429-equivalent
  error. The FE must catch this and show a user-friendly message.
  Copy key: `auth.login.errors.tooManyRequests`.
- **Email not in allowlist** (if allowlist gate is implemented — see OQ-3): User sees a
  generic "check your email" message regardless (do not confirm or deny whether the
  email is registered — prevents enumeration attacks).
- **Brevo SMTP down / email not delivered:** The user sees the "check your email"
  success state (Supabase queues the send). If email never arrives, the user must
  re-request. No silent failure state exists — Supabase Auth will log the delivery
  failure server-side.

### Auth callback

- **Link expired** (OTP older than 1 hour, per `otp_expiry = 3600` in config): Redirect
  to `/login?error=link_expired`. Copy key: `auth.callback.errors.linkExpired`.
- **Link already used** (second click on same magic link): Supabase returns an error.
  Redirect to `/login?error=link_expired` (same user-facing message — no need to
  distinguish).
- **Callback URL tampered / invalid token:** Redirect to `/login?error=invalid_link`.
  Copy key: `auth.callback.errors.invalidLink`.
- **User navigates to callback URL with no code/token:** Same as invalid token.
- **Network failure during token exchange:** Show error state on the callback route.
  Copy key: `auth.callback.errors.networkError`.

### Session

- **Access token expired, refresh succeeds:** Transparent to user (Supabase JS client
  handles automatically).
- **Access token expired, refresh fails** (refresh token expired or revoked): Redirect
  to `/login` with no error message (session simply ended naturally).
- **Session storage cleared** (user clears browser storage/cookies): Treated as
  unauthenticated; redirect to `/login`.
- **Concurrent magic-link requests from same email:** Supabase issues a new OTP on each
  valid request, invalidating the previous one. Only the most recent link works. No
  special handling needed in the UI beyond the rate-limit message.

### Logout

- **Logout while offline:** Client-side session clears (localStorage/cookies purged)
  even if the server-side revocation call fails. User is redirected to `/login`. The
  server-side revocation will fail silently — this is acceptable given the short JWT
  lifetime.
- **Logout button double-clicked:** Idempotent. Second call to `signOut()` is a no-op
  if already signed out.

### Localization

- All error and success strings have both `es` and `en` keys. No string ships in one
  language without the other.
- Locale is determined by the URL path prefix (`/en/login` vs `/login`), not by a
  cookie or `Accept-Language` header. This is consistent with the existing routing
  strategy (`as-needed` prefix, `es` at `/`).
- Magic-link email locale: must match the locale the user was in when they requested
  the link. How the locale is passed to Supabase's email template system is an
  architectural question (OQ-7).

---

## 6. Analytics & success metrics

### Events to track

All events use a consistent property shape: `{ timestamp, locale, source_page }`.

| Event name | When fired | Additional properties |
|---|---|---|
| `auth.magic_link.requested` | User submits email form | `email_domain` (not full email — no PII in events) |
| `auth.magic_link.sent_confirmed` | Success response received from Supabase | `email_domain` |
| `auth.magic_link.request_failed` | Error response from Supabase (rate limit, etc.) | `error_code` |
| `auth.callback.success` | Callback route exchanges token successfully | — |
| `auth.callback.failed` | Callback route receives an error | `error_code` |
| `auth.session.started` | User lands on dashboard post-login | — |
| `auth.logout.initiated` | User clicks logout button | — |
| `auth.logout.completed` | `signOut()` resolves | — |
| `auth.protected_route.redirected` | Unauthenticated user hits a protected route | `attempted_path` (no PII) |

**PII rule:** Full email addresses are never logged in analytics events. `email_domain`
(the part after `@`) is acceptable.

### Success metrics

- **Primary:** At least one studio owner can complete the full login → dashboard flow
  without human intervention in a dev environment demo. Binary pass/fail for v1.
- **Secondary (post-launch):** Magic-link-to-callback completion rate > 80% (measures
  email deliverability + UX clarity). Tracked via `auth.magic_link.sent_confirmed` vs
  `auth.callback.success` events.
- **Negative signal:** Any `auth.callback.failed` events with `error_code: link_expired`
  at a rate > 20% indicates the 1-hour OTP window is too short for real-world email
  delivery latency in Tulum (possible with spotty connectivity).

---

## 7. Roles & permissions

### v1 actor model

In v1, there is exactly one role that can authenticate: **studio owner**.

| Role | Can request magic link? | Can access dashboard? | Can access `/login`? |
|---|---|---|---|
| Unauthenticated | Yes | No (redirect to `/login`) | Yes |
| Authenticated studio owner | No (redirected to dashboard) | Yes | No (redirected) |
| Anonymous Supabase role | No (RLS blocks all data access) | No | N/A |

### Supabase RLS implications

Two new tables are introduced by this feature:

**`studios` table**
- `id` (uuid, primary key)
- `name` (text)
- `created_at` (timestamptz)
- (additional columns are a later feature — minimum viable for this spec)

**`studio_profiles` table**
- `id` (uuid, primary key, references `auth.users.id`)
- `studio_id` (uuid, references `studios.id`)
- `created_at` (timestamptz)

RLS policies required (architect to write the exact SQL per ADR-0003):

For `studio_profiles`:
- `SELECT`: authenticated user can read only where `id = auth.uid()`
- `UPDATE`: authenticated user can update only where `id = auth.uid()`
- `INSERT`: blocked for all roles via API (row is created by a privileged mechanism —
  see OQ-4; if auto-created on first login, a trusted server-side path with service role
  key must be used, not the anon key)
- `DELETE`: blocked for all roles via API

For `studios`:
- `SELECT`: authenticated user can read only where `id` matches their `studio_profiles.studio_id`
- `UPDATE`: authenticated user can update only where `id` matches their `studio_profiles.studio_id`
- `INSERT`: blocked for all roles via API
- `DELETE`: blocked for all roles via API

Both tables must pass the 4-case pgTAP test suite per ADR-0003:
`supabase/tests/rls_studio_profiles_test.sql` and `supabase/tests/rls_studios_test.sql`.

### Route protection model

- All routes under `/dashboard` (and any future protected namespace) require a valid
  authenticated session.
- Route protection is enforced at the Next.js middleware layer (server-side), not
  only on the client. A user who manually navigates to a protected URL must be
  redirected even before any React rendering occurs.
- The `/login` and `/auth/callback` routes are public (no auth required).
- The `/` home page (marketing placeholder) is public.

### NestJS API endpoints

No new NestJS API endpoints are introduced by this feature. Authentication is handled
entirely by Supabase Auth and the Next.js frontend. Future features that require the
NestJS API to verify the caller's identity will use the Supabase JWT passed in the
`Authorization: Bearer <token>` header, verified against Supabase's JWKS endpoint.
The mechanism for NestJS JWT verification should be addressed in an ADR before the
first API-backed feature (architect to flag).

---

## 8. Localization

All user-facing strings in this feature must be present in both `messages/es.json`
and `messages/en.json` simultaneously. No string ships in one language without the
other.

New translation namespaces required (both files, same structure):

```
auth.login.title
auth.login.subtitle
auth.login.emailLabel
auth.login.emailPlaceholder
auth.login.submitButton
auth.login.submittingButton
auth.login.successTitle
auth.login.successMessage
auth.login.resendButton
auth.login.errors.emailRequired
auth.login.errors.emailInvalid
auth.login.errors.tooManyRequests
auth.login.errors.genericError

auth.callback.redirecting
auth.callback.errors.linkExpired
auth.callback.errors.invalidLink
auth.callback.errors.networkError

auth.logout.button
auth.logout.confirmPrompt    (if a confirmation dialog is designed — see designer)
```

The toast keys `toast.success.loginLink.title` and `toast.success.loginLink.description`
already exist in the Foundation messages files (`es.json` and `en.json`) and cover the
success case. The `auth.*` namespace above is new.

**Magic-link email templates** (ES + EN): Both languages must be authored and configured
in Supabase Auth before this feature ships. Email template content is authored in this
spec; template configuration in Supabase (and how locale is passed to the template) is
an open question (OQ-7).

Draft email copy (subject and body, both locales):

*Spanish:*
- Subject: `Tu enlace para acceder a Massage Tulum`
- Body: `Hola, haz clic en el enlace a continuación para acceder a tu cuenta de
  Massage Tulum. Este enlace expira en 1 hora. [Acceder →] Si no solicitaste este
  enlace, ignora este mensaje.`

*English:*
- Subject: `Your sign-in link for Massage Tulum`
- Body: `Hi, click the link below to sign in to your Massage Tulum account. This
  link expires in 1 hour. [Sign in →] If you didn't request this, you can safely
  ignore this email.`

The designer will produce final polished copy and HTML email template design. The above
is the content baseline.

---

## 9. Open questions for human review

**OQ-1 — Magic-link redirect URL for Vercel preview deployments**
Each Vercel preview deployment gets a unique URL (e.g.,
`massage-tulum-abc123.vercel.app`). Supabase Auth's allow-list for redirect URLs does
not support wildcards for the full domain (it does support path wildcards). Options:
(a) Add each preview URL to the allow-list manually — not scalable.
(b) Use a single fixed Vercel preview alias (Vercel allows assigning a stable URL to
the latest preview) — workable for a solo developer.
(c) Use a single custom dev domain for all preview testing and only allow that + localhost.
**Human decision needed:** How do you want to handle preview deployments for the auth
callback? This affects the Supabase project configuration before the architect can
finalize the ADR.

**OQ-2 — Session lifetime policy**
The current `supabase/config.toml` has `jwt_expiry = 3600` (1 hour) with refresh
token rotation enabled. For a studio owner who leaves their browser open all day, silent
refresh should extend the session indefinitely while they are active. The question is:
what is the maximum refresh token lifetime (the absolute session ceiling)? Supabase
default is approximately 1 week. For a studio management app (non-financial, non-PII-
intensive), a 1-week ceiling seems reasonable.
**Human decision needed:** Is a 1-week maximum session lifetime acceptable, or do you
want a shorter/longer ceiling? (Shorter = more friction; longer = more risk on shared
devices.)

**OQ-3 — Account creation gate: who can get an account?**
With `enable_signup = true` in `config.toml`, ANY email address can trigger a magic
link and — on first use — a new `auth.users` row is created. This is likely not
desirable for a controlled studio management platform.
Options:
(a) **Admin-pre-seed:** The platform operator (you) manually inserts the studio owner's
email into `auth.users` via Supabase dashboard before they can log in. Signup is then
disabled (`enable_signup = false`).
(b) **Allowlist table:** A `studio_invitations` or `allowed_emails` table is maintained;
a Supabase Auth hook rejects signups for emails not on the list.
(c) **Open signup with manual approval:** Anyone can sign up, but they cannot access
the dashboard until a `studio_profiles` row is created by an admin.
(d) **Keep open signup for dev, add gate for prod:** Pragmatic for now.
**Human decision needed:** This is a product decision. Which model fits how you plan to
onboard studios? Option (a) is simplest for v1 with a single studio.

**OQ-4 — Who/what creates the `studios` and `studio_profiles` rows?**
This spec requires these rows to exist for a studio owner to function. But it does NOT
specify how they are created (since `INSERT` via the API is blocked for normal users per
the RLS policy). Options:
(a) **Admin manual insert** via Supabase Dashboard SQL editor — simplest for v1 with
one studio.
(b) **Seeded migration** for dev — the dev environment includes a seed file that creates
the test studio.
(c) **NestJS admin endpoint** (requires a separate ticket) — a protected admin route
that creates a studio and profile.
(d) **Auto-create on first login** — a Supabase Auth hook or database function creates
the rows on `auth.users` insert (requires care to avoid creating orphaned stubs).
**Human decision needed:** For v1, option (a) is most likely correct. Please confirm.
This affects the migration, seed file, and RLS policy design.

**OQ-5 — Logout scope: client-only vs. global token revocation**
`signOut({ scope: 'global' })` revokes all refresh tokens for the user across all
devices. `signOut({ scope: 'local' })` only clears the current device/tab.
For a studio management app used on a shared front-desk device, global revocation is
more secure. However, if the studio owner also has the app open on their phone, they
will be logged out everywhere.
**Human decision needed:** Should logout be global (revoke all sessions) or local
(current device only)?

**OQ-6 — Dashboard stub: new ticket or included here?**
AC-4 and AC-13 require a `/dashboard` route to exist as a post-login landing page.
This page does not need real content — a "You are logged in" placeholder is sufficient
for this spec. This could be:
(a) In-scope for this ticket (developer-fe creates a minimal stub as part of this work).
(b) A separate ticket spawned as a dependency (adds overhead but cleaner separation).
**Human decision needed:** Include the stub in this ticket or create a separate ticket?
Recommendation: include as in-scope (it is literally one server component with a logout
button and the studio name — the simplest possible thing).

**OQ-7 — Magic-link email locale: how is it passed to Supabase?**
Supabase Auth supports a `locale` parameter on `signInWithOtp()` which is stored in the
user's metadata and may influence which email template is used — but the behavior
depends on how custom templates are configured. The exact mechanism for sending Spanish
vs. English emails based on the user's current locale needs to be verified.
**Researcher task:** Verify Supabase Auth email template localization behavior (can you
configure separate `es` / `en` templates? does the `locale` param on `signInWithOtp`
drive template selection? is there a Brevo-specific consideration?). This must be
resolved before the developer starts.

---

## 10. Research needed

The following should be investigated by the `researcher` agent before the architect
writes the auth-related ADR(s):

**R1 — Supabase Auth magic-link + Brevo SMTP: exact configuration**
Verify the SMTP configuration required in `supabase/config.toml` (the commented-out
`[auth.email.smtp]` block) and in the Supabase Dashboard for the hosted dev project.
Confirm: (a) Brevo SMTP credentials format for Supabase, (b) sender domain
verification requirements, (c) whether Brevo free tier (300 emails/day) requires any
specific setup to avoid spam classification of magic-link emails.

**R2 — Supabase Auth email template localization**
Directly addresses OQ-7. Investigate: does Supabase Auth support locale-specific email
templates natively? Can the `locale` parameter on `signInWithOtp({ email, options: {
emailRedirectTo, data: { locale } } })` be used to select the right template? Or must
the frontend send two separate template variables and Supabase's single template uses
conditional logic? What is the recommended pattern for bilingual magic-link emails?

**R3 — Supabase Auth redirect URL configuration for Vercel previews**
Directly addresses OQ-1. Investigate: does Supabase support wildcard subdomains in the
redirect URL allow-list (e.g., `https://*.vercel.app`)? What is the current behavior
(2026) for Vercel preview URLs and Supabase Auth? Is there a documented pattern for
handling this in a monorepo Vercel deployment?

**R4 — Supabase Auth `signOut` scope behavior and refresh token revocation**
Directly addresses OQ-5. Verify the actual behavior of `signOut({ scope: 'global' })`
vs. `signOut({ scope: 'local' })` in `@supabase/ssr` (the package likely to be used in
a Next.js App Router context). Confirm whether global sign-out revokes tokens in the
Supabase database or only clears the client-side storage.

**R5 — Supabase Auth + Next.js App Router: recommended session handling pattern (2026)**
The Supabase team has published changing guidance on this over time
(`@supabase/auth-helpers-nextjs`, then `@supabase/ssr`). Verify the current (2026)
recommended pattern for:
(a) creating a Supabase client in Server Components vs. Client Components vs. middleware,
(b) refreshing the session in Next.js middleware (required to avoid stale JWTs in
Server Components),
(c) the auth callback route handler pattern for App Router,
(d) whether `@supabase/ssr` is the correct package or if something newer has replaced it.
This research is foundational to the developer's implementation.

---

## 11. Scope expansion from GATE 1 — self-signup + admin approval

This section captures the additional surface area introduced by the OQ-3 + OQ-4 decision.
Architect must reflect this in the ticket breakdown; designer must spec the new screens.

### Studio-owner self-signup flow

- Public route `/signup` (and `/en/signup`) with a form: email, studio name, contact phone (optional), free-text "tell us about your studio" field.
- Submission creates a row in `pending_studios` (status `pending`). It does NOT create an `auth.users` row, does NOT send a magic link, and does NOT create a `studios` or `studio_profiles` row.
- User is shown a localized confirmation: "Thanks — we'll review and email you when your studio is approved."
- Duplicate submission (same email already in `pending_studios` or already linked to a `studios` row) is silently de-duped: user sees the same confirmation message either way (no enumeration).
- Anti-abuse: rate-limit by IP (architect to choose mechanism — Supabase has limited primitives here; may need NestJS endpoint for the signup form instead of direct Supabase write). Captcha is **out of scope** for v1.

### Admin approval flow

- Admin-only route `/admin/pending-studios` (Spanish + English; the admin is you, but copy is bilingual on principle).
- List view of pending applications with the submitted fields, sorted oldest-first.
- Approve action: creates `studios` + `studio_profiles` rows, marks pending row `approved`, sends a localized welcome email containing a magic-link to log in (via existing magic-link path).
- Reject action: marks pending row `rejected` with optional reason note. No email sent (silent rejection in v1; revisit later).
- Admin authentication: out of scope for v1 — admin is identified by a hardcoded list of admin emails in env vars (`ADMIN_EMAILS=...`) or a single boolean column on `studio_profiles`. Architect to choose the simplest mechanism that doesn't paint us into a corner.

### Pre-approval login state

- If an `auth.users` row exists but no matching `studio_profiles` row (because the user got their account via magic-link before `studios` was created, or admin revoked them), the dashboard route renders a "Your studio is pending approval" state instead of redirecting to `/login`. This avoids a confusing redirect loop.
- Architect to decide whether this state is detected at middleware level or inside the dashboard route handler.

### New tables

**`pending_studios`**
- `id` (uuid, primary key)
- `email` (text, unique)
- `studio_name` (text)
- `contact_phone` (text, nullable)
- `description` (text)
- `status` (enum: `pending`, `approved`, `rejected`)
- `rejection_reason` (text, nullable)
- `submitted_at` (timestamptz)
- `reviewed_at` (timestamptz, nullable)
- `reviewed_by` (uuid, nullable, references `auth.users.id`)

RLS: anon role can `INSERT` only (with rate-limit consideration); admin role can `SELECT` / `UPDATE`; no role can `DELETE`. Studio owners cannot read their own pending row (no enumeration).

### New translation keys

```
auth.signup.title
auth.signup.subtitle
auth.signup.fields.email
auth.signup.fields.studioName
auth.signup.fields.contactPhone
auth.signup.fields.description
auth.signup.submitButton
auth.signup.successTitle
auth.signup.successMessage
auth.signup.errors.*

auth.dashboard.pendingApproval.title
auth.dashboard.pendingApproval.body

admin.pendingStudios.title
admin.pendingStudios.empty
admin.pendingStudios.columns.*
admin.pendingStudios.actions.approve
admin.pendingStudios.actions.reject
admin.pendingStudios.rejectModal.*
admin.pendingStudios.toast.*
```

### Welcome email (post-approval)

Bilingual templates, sent via Brevo:

*Spanish* — Subject: `Bienvenido a Massage Tulum — tu estudio ha sido aprobado` — body explains they can now log in and includes the magic-link.

*English* — Subject: `Welcome to Massage Tulum — your studio has been approved` — same content in English.

### Acceptance criteria additions

- AC-20: `/signup` form submission creates a `pending_studios` row and shows the confirmation. No `auth.users` row created.
- AC-21: Duplicate signup attempts (same email) succeed silently from the user's perspective; no second row created.
- AC-22: Admin route `/admin/pending-studios` is accessible only to users in the admin allowlist; non-admins get a 404 (not a 403 — don't reveal the route exists).
- AC-23: Admin approve action atomically: creates `studios` row, creates `studio_profiles` row linking applicant's email to the studio, updates `pending_studios.status = approved`, sends bilingual welcome email with magic-link.
- AC-24: Admin reject action updates `pending_studios.status = rejected` with optional reason; no email sent.
- AC-25: A user with `auth.users` row but no `studio_profiles` row sees a "pending approval" state on `/dashboard` (not a redirect to `/login`).
- AC-26: All RLS rules in §7 still hold for `studios` and `studio_profiles`. New table `pending_studios` has its own RLS test suite (4-case minimum per ADR-0003).

### Impact on size estimate

The original ticket was sized **S**. With self-signup + admin approval added, this is now closer to **M / L**. Architect should re-evaluate during ticket breakdown and may split this into sub-tickets:
- `studio-owner-magic-link-auth` (the original spec scope: login, callback, session, logout, dashboard stub)
- `studio-owner-self-signup` (signup form + `pending_studios` table)
- `admin-pending-studios-approval` (admin UI + approval/rejection actions + welcome email)

Splitting is recommended so each PR stays reviewable. Architect decides.
