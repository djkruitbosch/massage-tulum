# Security checklist (starter)

This is a starter checklist. The `researcher` agent will produce a fuller, version-stamped checklist in the first sprint, after which this file should be replaced or superseded.

## Hard rules (already in CLAUDE.md, repeated here)

- [ ] No secrets in code or version control.
- [ ] `.env*` files denied in `.claude/settings.json`.
- [ ] No PII in logs (emails, names with identifying data, phones, payment data).
- [ ] RLS on every Supabase table.
- [ ] Auth required on every endpoint by default. Public endpoints explicit + reviewed.
- [ ] CSP headers on Next.js.
- [ ] Dependency scanning in CI.

## Per-PR security checklist (reviewer enforces)

### Backend
- [ ] Every endpoint has auth requirement explicit.
- [ ] DTOs validate input shape, length, and type.
- [ ] No raw SQL — use Supabase client / parameterized queries only.
- [ ] No service-role Supabase key reachable from FE.
- [ ] PII encryption at rest where Supabase doesn't already cover it (check column-level needs).
- [ ] Rate limiting on auth endpoints, booking creation, message sending.

### Frontend
- [ ] No `dangerouslySetInnerHTML` without sanitization.
- [ ] Auth state never stored in localStorage if it includes refresh tokens — use cookies.
- [ ] CSRF tokens on state-changing server actions.
- [ ] No third-party scripts added without an ADR.
- [ ] Error messages don't leak internal info ("table users not found" → "something went wrong").

### Infra
- [ ] Secrets in platform secret stores (GitHub Actions, Vercel, hosting platform), never in code.
- [ ] CI does not echo secret values.
- [ ] Supabase service-role key only available to BE deployment — never to FE build env.

## Per-feature security review questions

When the architect designs a new feature:

- What data does this collect? Is any of it PII?
- Who has access to read it? Who has access to write it?
- Is there a path where a user could see another user's data? RLS verified?
- Does this feature send messages / emails / WhatsApp? What prevents abuse / spam?
- Does this feature accept user-uploaded files? Where do they go? What sanitization?
- Does this feature use external APIs? What's the failure mode if they're slow or down?
- Does this feature handle money? (If yes, defer to architect; payments are a separate workstream.)

## To research and turn into ADRs (early sprints)

- Mexico data protection (LFPDPPP) implications for booking PII.
- Supabase RLS pattern for multi-tenant studios (one studio's data isolated from another's).
- Auth strategy: Supabase Auth + magic links vs email/password vs OAuth.
- Session management on Next.js Server Components + Supabase.
- WhatsApp opt-in & template approval flow.

## References
- OWASP ASVS
- OWASP Top 10
- Supabase RLS docs
- Mexico LFPDPPP (verify current text — researcher to cite)
