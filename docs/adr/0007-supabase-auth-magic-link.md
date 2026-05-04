# ADR 0007: Supabase Auth — Magic Link (Email OTP) Only

**Status:** Accepted
**Date:** 2026-05-03
**Author:** architect (agent)
**Context tickets:** CU-869d29f1f, CU-869d4za1e

## Context

The platform needs an authentication mechanism for studio owners. Studio owners are not technical users. They visit the app infrequently (maybe a few times per week for managing bookings) and are unlikely to remember a separate password. The platform also has no customer-facing login at v1 — the only users logging in are studio owners and platform admins.

Key constraints:
- Studio owners are primarily Spanish-speaking, non-technical users in Tulum.
- Brevo is already in the stack for transactional email (free tier, 300 emails/day).
- Supabase Auth is already in the stack.
- No social login required for v1 (reduces OAuth credential management complexity).
- Security posture: studio owner accounts hold real business data (bookings, therapist info, customer names). Passwords must not be reused or weak.

## Decision

Use Supabase Auth magic link (email OTP) as the **sole authentication method** for v1.

- Password-based auth is **disabled**. No signup form with password fields.
- Studio owners enter their email. Supabase Auth sends a one-time-use link (token embedded in URL) or a 6-digit OTP. The user clicks the link or enters the OTP to authenticate.
- Link expiry: **7 days** (Supabase default, `otp_expiry = 604800`). This is intentionally long — studio owners check email sporadically. See Gate 2 amendment below for rationale.
- Rate limiting: `max_frequency = "60s"` — minimum 60 seconds between successive magic link emails per address. This prevents accidental spam loops and aligns with Brevo free-tier quota.
- OTP length: 6 digits (Supabase default).
- Social OAuth providers (Google, Apple, etc.): disabled for v1. May be added later via ADR amendment.

### Email delivery

Magic link emails are delivered via Brevo SMTP (smtp-relay.brevo.com:587). Credentials are stored as environment variables; they are never committed to code. See `apps/api/.env.example` for the var names.

### Redirect URL allow-list

The Supabase Auth redirect URL allow-list controls where the magic link token can land after click. Three URLs are permitted:

```
http://localhost:3000/**
http://127.0.0.1:3000/**
https://massage-tulum.dirk-jan.com/**
```

See Gate 2 amendment (2026-05-03) below for the rationale for the custom domain over a Vercel slug.

### Password auth disable procedure

The Supabase CLI `config.toml` does not expose a `[auth.password]` section as of CLI v1.x. Password auth must be disabled in the Supabase Dashboard:

> Authentication → Providers → Email → toggle off "Enable Email Signups" (for password flows) OR keep Email enabled but ensure no "password" field is exposed in the frontend. Since the frontend never renders a password input and the backend never calls `signInWithPassword`, this is enforced at the application layer. The Dashboard toggle is a defense-in-depth step.

This is a manual step for the dev Supabase project. Documented in `docs/runbooks/supabase-project-setup.md`.

## Consequences

**Positive:**
- No password storage = no password breach risk.
- Studio owners never forget their "password" — they just use their email.
- Simple auth flow: one input field (email) + one click in inbox.
- Supabase handles token generation, expiry, and session management.

**Negative:**
- Requires inbox access for every login — not suitable if email delivery is slow or goes to spam.
- 7-day expiry is longer than ideal from a pure security standpoint. Mitigated by: (a) single-use tokens (each click invalidates the token), (b) Supabase session revocation via service role key if account compromise is suspected.
- If Brevo SMTP goes down, users cannot log in. Mitigation: UptimeRobot alert on auth endpoint + Brevo free-tier fallback plan.

**Neutral / follow-up:**
- Bilingual email templates (Spanish + English) are addressed in ADR-0009.
- Brevo SMTP setup is addressed in `docs/runbooks/supabase-project-setup.md`.

## Alternatives considered

**Password + email:** Rejected. Adds password reset flow complexity, password strength requirements, and breach risk. Studio owners forget passwords.

**Social OAuth (Google):** Rejected for v1. Requires OAuth app creation and review per provider. Most Tulum studio owners use Gmail but the setup and maintenance overhead outweighs the UX gain at v1 scale.

**WhatsApp OTP:** Considered but deferred. WhatsApp provider TBD (Meta Cloud API or Twilio). Will revisit in a later sprint.

**Passkeys (WebAuthn):** Not supported by Supabase Auth as of 2026. Revisit when available.

## Implementation notes

- `supabase/config.toml`: `[auth.email]` section sets `enable_confirmations = true`, `max_frequency = "60s"`, `otp_expiry = 604800` (7 days), `otp_length = 6`.
- `supabase/config.toml`: `[auth.email.smtp]` block is uncommented with Brevo settings.
- `supabase/config.toml`: `additional_redirect_urls` is updated per Gate 2 amendment.
- Password auth disable: manual step in Supabase Dashboard (documented in setup runbook).

---

## Amendment: 2026-05-03 — Gate 2 approval changes

**Approved by:** project owner (human) via ClickUp ticket CU-869d4za1e Gate 2 comments.

### 1. Redirect URL — custom subdomain

The original design proposed using a Vercel account-slug wildcard (`*.vercel.app`) or the Vercel project URL for the dev redirect allow-list. This is **superseded**:

**Decision:** The dev callback domain is `https://massage-tulum.dirk-jan.com` — a custom subdomain on the project owner's controlled DNS. This provides:
- A stable, human-readable URL that does not change when Vercel project names change.
- No reliance on Vercel's internal slug format.
- A domain the owner controls, so DNS verification for Brevo DKIM can be performed on the same apex domain.

The Vercel deployment for dev is configured to serve at `massage-tulum.dirk-jan.com`. DNS records required: see `docs/runbooks/supabase-project-setup.md`.

**`additional_redirect_urls` in `supabase/config.toml`:**
```toml
additional_redirect_urls = [
  "http://localhost:3000/**",
  "http://127.0.0.1:3000/**",
  "https://massage-tulum.dirk-jan.com/**"
]
```

### 2. Magic link expiry — 7 days (confirmed)

Original proposal was 24h expiry. Gate 2 review confirmed **7 days** (604800 seconds) for dev, on the grounds that studio owners check email infrequently. The token is single-use; if a link is clicked it is immediately invalidated. Revocation via service role key is available for compromise scenarios.

This is the Supabase `otp_expiry` value. For production, this may be revisited when real users are onboarded.
