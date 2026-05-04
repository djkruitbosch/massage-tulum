# ADR 0009: Bilingual Supabase Email Templates

**Status:** Accepted
**Date:** 2026-05-03
**Author:** architect (agent)
**Context tickets:** CU-869d29f1f, CU-869d4za1e

## Context

Supabase Auth sends transactional emails for magic link login, email confirmation, and password recovery. The platform serves studio owners in Tulum, Mexico — primarily Spanish speakers — alongside potentially English-speaking owners or support staff.

CLAUDE.md mandates: "i18n via next-intl. No hardcoded strings. Both `es` and `en` populated at the same time — never ship one without the other."

The challenge is that Supabase Auth email templates are a single template per event type, configured either via the Supabase CLI `config.toml` or the Dashboard UI. Supabase does not natively support per-user language selection for auth emails.

## Decision

### Template strategy: Spanish-first with inline English fallback

Supabase Auth email templates are HTML files stored in `supabase/templates/`. Each template is a single file per event type.

Since we cannot dynamically select language per-user at the Supabase Auth layer (without a custom email provider), we adopt a **Spanish-first with inline English block** approach:

1. Spanish is the primary language (displayed prominently at top).
2. An English translation follows below a thin horizontal rule or divider.
3. The template is bilingual: one email, both languages, no dynamic selection needed.

This is the simplest viable approach that satisfies the i18n requirement without requiring a custom Auth hook or email proxy.

### Templates to create

| Event | File |
|---|---|
| Magic link / sign-in OTP | `supabase/templates/magic-link.html` |
| Email confirmation (new user) | `supabase/templates/confirmation.html` |
| Email change confirmation | `supabase/templates/email-change.html` |

Password recovery is disabled (no passwords — see ADR-0007). Recovery template is not needed.

### Template deployment

**Local dev:** Supabase CLI uses the template files from `supabase/templates/` automatically via the `[auth.email]` template path references in `config.toml`.

**Hosted Supabase project (dev, uat, prod):** The Supabase CLI `supabase db push` and `supabase db remote commit` commands do NOT push email templates to the hosted project. Templates must be copied manually into the Supabase Dashboard:

> Authentication → Email Templates → [select event type] → paste HTML content from `supabase/templates/<file>.html`

This is a manual step. It must be performed when:
- Setting up a new Supabase environment (dev, uat, prod).
- Updating a template (re-paste the new content).

This limitation is a known Supabase constraint as of CLI v1.x. Tracked in `docs/runbooks/supabase-project-setup.md`.

### Supabase template variables

Templates use Supabase's built-in template variables:
- `{{ .SiteURL }}` — the site URL configured in Supabase Auth settings.
- `{{ .Token }}` — the magic link token (for OTP-style templates).
- `{{ .TokenHash }}` — the token hash (for link-style templates).
- `{{ .RedirectTo }}` — the redirect destination after authentication.
- `{{ .Email }}` — the recipient email address.

## Consequences

**Positive:**
- Studio owners receive a readable Spanish email without needing to set a language preference.
- English-speaking users also have a translation in the same email.
- Templates are version-controlled in the repo alongside migrations.
- No custom Auth hook or email proxy required (avoids infrastructure complexity).

**Negative:**
- Bilingual emails are longer than single-language emails. For a magic link email this is acceptable (few lines of text).
- Manual copy-paste into Supabase Dashboard is a friction point for new environment setup. Mitigated by the setup runbook.
- If Supabase later supports per-user language selection, this approach can be superseded via a new ADR — templates would be split into per-language files.

**Neutral / follow-up:**
- Template HTML files are created as part of ticket CU-869d4za1e.
- SMTP delivery is handled by Brevo — see ADR-0007 and `docs/runbooks/supabase-project-setup.md`.

## Alternatives considered

**English-only templates:** Rejected. Violates the i18n requirement in CLAUDE.md. Studio owners in Tulum are primarily Spanish speakers.

**Spanish-only templates:** Rejected. There may be English-speaking owners or support personnel. English fallback costs nothing extra in the bilingual approach.

**Custom Auth hook to select language per user:** Considered. A Supabase Edge Function could inspect the user's metadata and call the Brevo API directly with a language-specific template. Deferred — adds significant complexity (Edge Function, Brevo template management, auth hook wiring) that is not justified at v1 scale with a handful of studio owners. Revisit post-v1.

**Supabase custom SMTP with a NestJS email proxy:** Rejected. Would require NestJS to intercept every auth email — tight coupling between the backend and Supabase Auth internals. Fragile.

## Implementation notes

- Template files live at `supabase/templates/*.html`.
- `config.toml` references these via path if the Supabase CLI supports template path overrides; otherwise the hosted project requires manual copy-paste per the Dashboard procedure.
- The setup runbook (`docs/runbooks/supabase-project-setup.md`) covers the copy-paste procedure step by step.
