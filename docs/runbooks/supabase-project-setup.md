# Runbook: Supabase Hosted Project Setup

**Last updated:** 2026-05-03
**Owner:** developer-devops (agent)
**Ticket:** CU-869d4za1e
**Related ADRs:** [ADR-0002](../adr/0002-supabase-environment-strategy.md), [ADR-0007](../adr/0007-supabase-auth-magic-link.md), [ADR-0009](../adr/0009-bilingual-supabase-email-templates.md)

---

## When to use this

Run this runbook when provisioning a new hosted Supabase project for any environment (`dev`, `uat`, or `prod`). It covers the manual configuration steps that the Supabase CLI cannot perform automatically:

- SMTP credentials (Brevo).
- Auth redirect URL allow-list.
- Email template content.
- Password auth disable.
- DNS records for Brevo email deliverability.
- Coolify environment secrets.

The local dev stack (`supabase start`) does NOT require any of these steps — Inbucket handles email locally and there is no remote auth configuration involved.

---

## Pre-conditions

- You have created the Supabase project in the [Supabase Dashboard](https://app.supabase.com) and have owner or admin access.
- The Supabase CLI is installed and authenticated: `supabase login`.
- You have access to the Brevo account: [app.brevo.com](https://app.brevo.com).
- You have DNS access to `dirk-jan.com` (for dev) or the prod domain (for prod).
- You have access to the Coolify dashboard for the backend environment.

**SECURITY NOTE:** If any Brevo SMTP key or API key was previously shared in a chat message, Slack, email, or any non-secret-store channel, treat it as **compromised**. Regenerate both keys before proceeding. See "Regenerate Brevo keys" section below.

---

## Section 1: Brevo SMTP credentials

### 1.1 Locate or regenerate SMTP credentials

1. Log in to [app.brevo.com](https://app.brevo.com).
2. Navigate to: **SMTP & API** (top navigation) → **SMTP** tab.
3. Note the **Login** field — this is `BREVO_SMTP_USER` (your Brevo account email).
4. Under **SMTP keys**, if an existing key exists and has been compromised, delete it. Click **Generate a new SMTP key**.
5. Copy the generated key immediately — it is only shown once.
6. This key is `BREVO_SMTP_PASS`.

**WARNING: `BREVO_SMTP_PASS` is the SMTP key from the SMTP tab — it is NOT your Brevo account password and NOT the HTTP API key from the API Keys tab. These are three different credentials.**

### 1.2 Locate or regenerate HTTP API key

1. In Brevo Dashboard: **SMTP & API** → **API Keys** tab.
2. If an existing key has been compromised, delete it. Click **Generate a new API key**.
3. Name it (e.g. `massage-tulum-dev`). Copy the generated key immediately.
4. This key is `BREVO_API_KEY`.

---

## Section 2: DNS records for Brevo email deliverability

These records ensure magic link emails from `noreply@massage-tulum.dirk-jan.com` are delivered and not marked as spam.

DNS changes are made at your DNS registrar or DNS provider for `dirk-jan.com`.

### 2.1 Get Brevo-specific values

1. In Brevo Dashboard: **Senders & IP** (top navigation) → **Domains** tab.
2. Click **Add a domain** (or select existing) and enter `massage-tulum.dirk-jan.com`.
3. Brevo will display the exact TXT and CNAME values to add. **Use those exact values** — the examples below show the record types and names; the values are account-specific.

### 2.2 DNS records to add

Add all of the following records to the DNS zone for `dirk-jan.com`:

**Brevo domain verification TXT:**

| Type | Name | Value |
|------|------|-------|
| TXT | `massage-tulum.dirk-jan.com` | (value from Brevo Dashboard → Domains → verification TXT) |

**Brevo DKIM CNAME records:**

| Type | Name | Value |
|------|------|-------|
| CNAME | `mail._domainkey.massage-tulum.dirk-jan.com` | (value from Brevo Dashboard → Domains → DKIM) |
| CNAME | `mail2._domainkey.massage-tulum.dirk-jan.com` | (value from Brevo Dashboard → Domains → DKIM2) |

**DMARC policy TXT:**

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc.massage-tulum.dirk-jan.com` | `v=DMARC1; p=none; rua=mailto:dirk-jan@dirk-jan.com` |

**Note:** `p=none` starts in monitoring mode. Once you confirm email delivery is working, consider tightening to `p=quarantine` or `p=reject` in a follow-up ADR.

### 2.3 Verify DNS propagation

After adding records, verify via Brevo Dashboard → Domains → click **Authenticate** or **Check**. Allow up to 24–48 hours for propagation, though it often completes in minutes.

You can also check from your terminal:

```bash
# Verify DKIM CNAME (replace with your actual CNAME value from Brevo)
dig CNAME mail._domainkey.massage-tulum.dirk-jan.com

# Verify DMARC TXT
dig TXT _dmarc.massage-tulum.dirk-jan.com
```

---

## Section 3: Supabase Dashboard — SMTP configuration

This configures the hosted Supabase project to use Brevo SMTP for outbound auth emails.

1. Open the Supabase Dashboard for the target project.
2. Navigate to: **Authentication** → **Providers** → **Email**.
3. Scroll to **SMTP Settings** (or **Custom SMTP**) and toggle it on.
4. Fill in:
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Minimum Interval (seconds):** `60`
   - **Username:** your `BREVO_SMTP_USER` value (Brevo login email)
   - **Password:** your `BREVO_SMTP_PASS` value (Brevo SMTP key)
   - **Sender name:** `Massage Tulum`
   - **Sender email:** `noreply@massage-tulum.dirk-jan.com`
5. Click **Save**.
6. Send a test email to verify delivery.

**Note:** The `supabase/config.toml` `[auth.email.smtp]` block uses `env(BREVO_SMTP_USER)` and `env(BREVO_SMTP_PASS)` for local development environment variable injection. The hosted project reads credentials from the Dashboard UI settings above, not from the TOML file directly.

---

## Section 4: Supabase Dashboard — Auth redirect URL allow-list

1. In Supabase Dashboard: **Authentication** → **URL Configuration**.
2. Set **Site URL** to the primary app URL for this environment:
   - Dev: `https://massage-tulum.dirk-jan.com`
   - UAT: (TBD when provisioned)
   - Prod: (TBD at launch)
3. Under **Redirect URLs**, add these three entries (one per line):

   ```
   http://localhost:3000/**
   http://127.0.0.1:3000/**
   https://massage-tulum.dirk-jan.com/**
   ```

4. Click **Save**.

These match the values in `supabase/config.toml` `additional_redirect_urls`. See ADR-0007 (amendment 2026-05-03) for rationale.

---

## Section 5: Supabase Dashboard — Email templates

The Supabase CLI (`supabase db push`, `supabase db remote commit`) does NOT push email templates to the hosted project. Templates must be configured manually in the Dashboard.

For each template file in `supabase/templates/`:

1. In Supabase Dashboard: **Authentication** → **Email Templates**.
2. Select the template type (Magic Link, Confirm signup, etc.).
3. Open the corresponding `supabase/templates/<file>.html` from this repository.
4. Copy the full HTML content and paste it into the Dashboard editor.
5. Click **Save**.

Repeat this process whenever a template file is updated in the repository.

**Template files and their Dashboard counterparts:**

| File | Dashboard template |
|------|--------------------|
| `supabase/templates/magic-link.html` | Magic Link |
| `supabase/templates/confirmation.html` | Confirm signup |
| `supabase/templates/email-change.html` | Change email address |

See ADR-0009 for the bilingual (Spanish + English) template strategy.

---

## Section 6: Supabase Dashboard — Disable password auth

The platform uses magic-link only (ADR-0007). Password-based sign-in must be disabled.

1. In Supabase Dashboard: **Authentication** → **Providers** → **Email**.
2. Locate the **Enable Email Signups** or password-related toggle.
3. Ensure password sign-in is **disabled**. Magic link / OTP sign-in should remain enabled.
4. Click **Save**.

**Note:** The Supabase CLI `config.toml` does not expose a `[auth.password]` table — this disable is a Dashboard-only setting. It must be re-applied whenever a new project is provisioned.

---

## Section 7: Coolify secrets

The NestJS API runs in Coolify. Set the following environment variables in the Coolify service settings for each environment:

1. Open Coolify Dashboard → your service → **Environment Variables**.
2. Add each variable as a **secret** (not plain text):

| Variable | Value | Notes |
|----------|-------|-------|
| `BREVO_SMTP_USER` | `dirk-jan@dirk-jan.com` | Brevo login email |
| `BREVO_SMTP_PASS` | `<regenerated SMTP key>` | From Section 1.1 above |
| `BREVO_API_KEY` | `<regenerated API key>` | From Section 1.2 above |
| `ADMIN_EMAILS` | `dirk-jan@dirk-jan.com` | Comma-separated admin emails |

**SECURITY:** The keys originally pasted in chat are considered compromised and MUST be regenerated (see Section 1 above) before entering them here. Never paste keys from chat into production environments.

3. Save and redeploy the service to pick up the new environment variables.

---

## Section 8: Production `max_frequency` and `otp_expiry`

**`max_frequency` (rate-limit on magic-link requests).**
`supabase/config.toml` keeps the Supabase default `"1s"` for local dev ergonomics (so Inbucket testing is fast). The hosted dev/uat/prod projects must override this to `"60s"` per spec AC-5. Set it via Dashboard → Authentication → Settings → "Email" section → "Minimum interval between requests" (or the SMTP "Minimum Interval" field, depending on Dashboard version). Confirm the value is `60` seconds when configuring each environment.

**`otp_expiry` (magic-link lifetime).**
`supabase/config.toml` keeps the Supabase default `3600` (1 hour) for the routine `signInWithOtp()` login flow. **Do not raise this globally.** The welcome magic-link sent on admin approval uses a per-link 7-day expiry override implemented inside the NestJS approval endpoint (`apps/api/src/studios/studios.service.ts`) via `supabase.auth.admin.generateLink()`. See ADR-0007 amendment 2026-05-03 (split expiry).

If you change `otp_expiry` in the Dashboard for any environment, document the rationale in this runbook and update ADR-0007 with a new amendment.

---

## Verification

After completing all sections:

1. **SMTP test:** Use Supabase Dashboard → Authentication → Email Templates → **Send test email** to verify Brevo SMTP delivery.
2. **Magic link test:** Attempt a sign-in via the app UI. Check that the magic link email arrives and the link redirects correctly to `https://massage-tulum.dirk-jan.com` (dev).
3. **DMARC report:** After 24 hours of traffic, check for DMARC reports at `dirk-jan@dirk-jan.com`.
4. **Inbucket (local dev only):** Local emails are captured at `http://localhost:54324` — no actual email is sent. Confirm local magic links work by checking Inbucket.

---

## Rollback

**SMTP misconfiguration:** Re-enter the correct credentials in Supabase Dashboard → Authentication → SMTP Settings. There is no "undo" — re-enter correct values.

**Template misconfiguration:** Paste the corrected HTML from `supabase/templates/` back into the Dashboard. Previous template content is not stored by Supabase — use the git history of `supabase/templates/` as the source of truth.

**Redirect URL misconfiguration:** Update the allow-list in Supabase Dashboard → Authentication → URL Configuration.

---

## Common failures

**Magic link email not arriving:**
1. Check Brevo Dashboard → SMTP activity log for delivery errors.
2. Verify SMTP credentials in Supabase Dashboard are correct.
3. Check spam/junk folder.
4. Verify DNS records are propagated (Section 2.3).

**Magic link redirect fails (PKCE error / redirect not allowed):**
The redirect URL used by the app is not in the allow-list. Add it to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (Section 4).

**Brevo "Sender not authenticated" error:**
DNS records are not yet propagated or are incorrect. Re-verify against Brevo Dashboard → Domains.

**`supabase start` fails after config.toml SMTP change:**
The `[auth.email.smtp]` block in `config.toml` uses `env(BREVO_SMTP_USER)` / `env(BREVO_SMTP_PASS)`. For local dev, these env vars do not need to be set — Supabase CLI uses Inbucket regardless and does not validate SMTP credentials locally. If `supabase start` fails with an env var error, set dummy values in your shell: `export BREVO_SMTP_USER=local BREVO_SMTP_PASS=local` before running `supabase start`.
