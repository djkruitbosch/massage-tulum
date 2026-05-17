# v1 Roadmap (2026-04-26)

# v1 Roadmap — Massage Tulum

**Date:** 2026-04-26
**Author:** product-manager (agent), facilitated by main session
**Status:** Approved (initial draft). Revisions create a new dated doc and supersede this one. This roadmap is not final.
* * *

## v1 success definition

**90-day locked metric:** ONE real Tulum studio uses the app daily to manage their bookings.

**The spine — what the owner does first, every day:** The studio owner opens the app, sees today's bookings across both therapists at a glance, and can reschedule or cancel one in under 30 seconds — without scrolling WhatsApp, without guessing if a slot is free, without telling the affected therapist separately.
* * *

## Out of scope for v1

The following are explicitly v2 or later. Any ticket that touches these must be rejected or re-scoped before work begins.

*   Customer-facing booking flow (public booking page, customer self-booking)
*   Stripe / payments (no payment processing or invoicing in v1)
*   Therapist self-service login (owner manages everything on therapists' behalf in v1)
*   Multi-location support
*   Customer reviews and ratings
*   Email marketing and bulk messaging
*   Memberships and package pricing
*   Group bookings
*   Custom branding (custom domain, logo upload, color theming)
*   Detailed analytics dashboard (revenue trends, utilization reports, etc.)
*   Custom intake form builder (basic notes field on customer record IS in v1; form builder is NOT)
*   WhatsApp message ingestion or auto-booking from chat (v2+ rabbit hole)
*   Any automated inbound channel (bookings come in via manual owner entry only in v1)
*   Per-studio configurable timezone (v1 is fixed America/Cancun)
*   Password-based auth and password-reset flow (v1 is magic-link only)
* * *

## Decided product questions (2026-04-26)

These were open in the initial draft and have been resolved by the project owner:

*   **Currency for service pricing:** Both **MXN and USD** are supported in v1. Spec must decide whether currency is set per service or per booking, and how the booking record captures it for historical accuracy.
*   **Authentication method:** **Magic link only** in v1. No password, therefore no password-reset flow.
*   **Timezone:** **Fixed to America/Cancun** in v1. No per-studio configuration. Multi-timezone is v2+.
* * *

## Assumptions

These are the beliefs baked into this roadmap. A real Tulum studio owner could disprove any of them. The riskiest are marked **(HIGH RISK)**.

1. **(HIGH RISK)** Studio-side pain is real and significant. The premise of v1 — that owners are frustrated managing bookings in WhatsApp — is unvalidated. The first studio profile (small studio in Aldea Zama, ~2 therapists, primarily WhatsApp-based, non-technical owner) is a best-guess, not a validated customer. The architect should bias the data model toward flexibility over optimization until real studio feedback arrives.
2. **(HIGH RISK)** The owner, not the therapist, is the primary operator. If therapists need visibility/input into their own schedules, the v1 model breaks.
3. The studio has a fixed, relatively stable set of services and prices.
4. A daily, multi-column timeline (one column per therapist) is the right primary UI for the owner. Alternatives (weekly, list-first) may be preferred. Test early.
5. The owner speaks Spanish as their primary language; English ships simultaneously but Spanish is design-first.
6. Sessions are atomic: one therapist, one customer, one slot. No couples massages, two-therapist sessions, or group classes in v1.
7. The studio has a fixed location and fixed operating hours (with day-of-week variation supported). Timezone is hardcoded to America/Cancun.
8. Customers are uniquely identified by name + phone number. No accounts, no passwords, no customer portal in v1.
9. Owner authenticates via magic link (email-based, no password). Acceptable for a non-technical owner with a single account.
* * *

## Personas

*   **Studio owner (primary)** — books all appointments manually after WhatsApp requests; manages therapists, services, availability. Not technical. Spanish primary. Mostly desktop, occasionally mobile.
*   **Therapist (secondary)** — no login in v1. Owner manages their schedule. May receive WhatsApp notifications if Feature 11 ships. Named on bookings.
*   **Customer (v2 — not designed for in v1)** — exists in v1 only as a record (name, phone, optional notes). No notifications, no interface.
* * *

## Feature inventory

15 features total. Each has priority, size, dependencies, open questions, success-mapping, and an "assumption-laden?" flag.

### Feature 0: Infrastructure foundation

*   **Priority:** P0 (prerequisite — nothing else can be built or deployed without it)
*   **Size:** M
*   **Assumption-laden?** No
*   **Description:** Turborepo + pnpm monorepo init, Next.js app scaffold, NestJS API scaffold, Supabase project + RLS baseline, GitHub Actions CI pipeline, BE hosting decision (per architect ADR), Vercel FE deploy, shared `packages/shared` and `packages/ui` stubs.
*   **Why it matters:** Every other feature depends on this.
*   **Depends on:** Nothing.
*   **Open questions:** BE hosting provider (Railway / Fly / Render) — architect ADR required. Supabase project structure for dev/uat/prod.
*   **Maps to:** Prerequisite for all v1 success criteria.

### Feature 1: Studio owner authentication

*   **Priority:** P0
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** Owner logs in via **magic link** (Supabase Auth, no password). One account per studio in v1.
*   **Why P0:** No protected route or RLS policy works without verified identity.
*   **Depends on:** Feature 0.
*   **Open questions:** None — magic link decided 2026-04-26.
*   **Maps to:** Prerequisite for all v1 success criteria.

### Feature 2: Studio profile setup

*   **Priority:** P0
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** Owner sets studio name, neighborhood/address, operating hours by day, WhatsApp number. **Timezone is fixed to America/Cancun.**
*   **Why P0:** Operating hours define valid time slots; the schedule has no anchor without it.
*   **Depends on:** Feature 1.
*   **Open questions:** None — timezone decided 2026-04-26.
*   **Maps to:** Foundation for schedule and availability logic.

### Feature 3: Therapist roster management

*   **Priority:** P0
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** Owner adds/edits/deactivates therapists (name, phone, optional notes). No therapist login in v1.
*   **Why P0:** Therapists are the columns of the schedule.
*   **Depends on:** Feature 2.
*   **Open questions:** Multi-studio therapist? Likely no — confirm. Deactivated therapist visibility on schedule?
*   **Maps to:** Enables schedule and all booking ops.

### Feature 4: Service catalog management

*   **Priority:** P0
*   **Size:** S
*   **Assumption-laden?** Partial (assumes a fixed catalog is sufficient)
*   **Description:** Owner creates services (name, description, duration, price, currency). **Both MXN and USD supported in v1.** Edit/deactivate. Bookings reference one service. Price + currency captured on booking record for historical accuracy.
*   **Why P0:** Duration drives availability logic. Price is captured on the booking record for historical accuracy.
*   **Depends on:** Feature 2.
*   **Open questions:** Currency at service level vs booking level (spec to decide). Multiple price tiers per service (e.g., 60 vs 90 min)?
*   **Maps to:** Enables booking creation; supports eventual revenue visibility.

### Feature 5: Daily schedule view (THE SPINE)

*   **Priority:** P0
*   **Size:** M
*   **Assumption-laden?** **YES** — the column-per-therapist daily layout is unvalidated. Test with a real studio ASAP.
*   **Description:** Owner views today's bookings as a timeline with one column per therapist. Each booking is a time block (service, customer, time). Day navigation. Current time indicated.
*   **Why P0:** This IS the v1 value proposition. Everything else serves this view.
*   **Depends on:** Features 1, 2, 3, 4, 7.
*   **Open questions:** Show empty/available slots? How to surface non-standard days (sick, day off)?
*   **Maps to:** Directly maps to the 90-day metric and the "first 10 minutes" pain.

### Feature 7: Manual booking creation

*   **Priority:** P0
*   **Size:** M
*   **Assumption-laden?** No
*   **Description:** Owner creates a booking by selecting therapist, service, date/time, customer (new or existing). System validates availability + conflicts. Visible immediately on schedule.
*   **Why P0:** v1's only data-entry path. Without it the schedule is empty.
*   **Depends on:** Features 3, 4, 5; Feature 6 nice-to-have for full validation.
*   **Open questions:** Conflict behavior — hard block or warning + override? Booking outside availability with a warning?
*   **Maps to:** Directly enables the 30-second reschedule/cancel metric.

### Feature 8: Booking reschedule and cancel

*   **Priority:** P0
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** From the schedule view, owner taps a booking to reschedule (date/time/therapist) or cancel (soft). Reschedule validates the new slot.
*   **Why P0:** This is the explicit verbatim benchmark — "reschedule or cancel one in under 30 seconds."
*   **Depends on:** Features 5, 7.
*   **Open questions:** Undo cancel in v1? Cancelled-booking visibility (hidden, greyed, removed)?
*   **Maps to:** The 30-second benchmark in the v1 success definition.

### Feature 14: Validation checkpoint — demo to one real Tulum studio

*   **Priority:** P0 (milestone, not a code feature)
*   **Size:** S (effort: founder runs a structured demo + interview)
*   **Assumption-laden?** N/A
*   **Description:** After Features 0–8 are live, demo the working app to ≥1 real Tulum studio owner. 30-min structured session: observe, note confusion, ask what they'd pay for. Output: research doc + roadmap revision before continuing P1/P2.
*   **Why P0:** Circuit breaker on the human's biggest fear — "building the wrong thing for too long."
*   **Depends on:** Features 0–8.
*   **Open questions:** Who is the first studio? Founder's network, not an agent.
*   **Maps to:** Risk mitigation for the 90-day metric; could trigger pivot.

### Feature 6: Therapist availability configuration

*   **Priority:** P1
*   **Size:** M
*   **Assumption-laden?** **YES** — assumes regular weekly schedule. Variable availability is common (tourism seasonality, part-time staff).
*   **Description:** Owner configures each therapist's standard working hours by day of week. Defines valid booking windows. Non-working hours blocked on schedule.
*   **Why P1:** Owner can mentally track availability early; the schedule becomes trustworthy with this.
*   **Depends on:** Features 3, 5.
*   **Open questions:** One-off exceptions (sick day) — booking block, "unavailability" record, or out of scope?
*   **Maps to:** Makes the schedule trustworthy.

### Feature 9: Customer record management

*   **Priority:** P1
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** Owner can select existing customer or create new (name + phone required, notes optional) at booking time. Searchable. Booking history per customer.
*   **Why P1:** Returning customers are the norm. CRM-lite reduces WhatsApp scrolling.
*   **Depends on:** Feature 7.
*   **Open questions:** Phone-only unique key, or name + phone? Phone change handling? Notes free-text or structured?
*   **Maps to:** Reduces reliance on WhatsApp as a CRM.

### Feature 10: Owner booking confirmation email

*   **Priority:** P1
*   **Size:** S
*   **Assumption-laden?** No
*   **Description:** On booking create/reschedule/cancel, owner receives a Brevo email summary (therapist, service, customer, date/time).
*   **Why P1:** Out-of-app audit trail; safety net; validates Brevo integration early.
*   **Depends on:** Features 7, 8.
*   **Open questions:** Owner only, or also customer email if known? (Likely owner-only in v1 — confirm.)
*   **Maps to:** Daily operational confidence.

### Feature 12: Upcoming bookings list view

*   **Priority:** P1
*   **Size:** S
*   **Assumption-laden?** Partial (assumes weekly planning view is useful)
*   **Description:** List view of next 7 days, sortable by date/time, filterable by therapist. Each row: date, time, therapist, service, customer.
*   **Why P1:** Owners plan more than one day ahead; daily view alone is insufficient.
*   **Depends on:** Features 5, 7.
*   **Open questions:** Extend to 30 days? Click-through to edit?
*   **Maps to:** Operational planning beyond today.

### Feature 11: Therapist WhatsApp notification on booking change

*   **Priority:** P2 (nice-to-have, not rejection-grade per human)
*   **Size:** M
*   **Assumption-laden?** **YES** — assumes therapists use WhatsApp for work, studio has WhatsApp Business account, provider viable on free/low-cost tiers. All three unvalidated.
*   **Description:** When a booking is created/rescheduled/cancelled for a therapist, send outbound WhatsApp message. **Outbound only — no inbound parsing.**
*   **Why P2:** Closes a loop the owner can close manually. Onboarding cost (Meta verification, number registration, template approval) is non-trivial.
*   **Depends on:** Features 3, 7, 8; architect ADR on WhatsApp provider.
*   **Open questions:** Provider — Meta Cloud API vs Twilio. Failure surfacing. Studio WhatsApp Business account requirement.
*   **Maps to:** Reduces manual coordination.

### Feature 13: Basic booking summary

*   **Priority:** P2
*   **Size:** S
*   **Assumption-laden?** **YES** — count without revenue may not be actionable.
*   **Description:** Simple page showing total bookings today, this week, breakdown by therapist. No revenue (Stripe deferred). No charts in v1.
*   **Why P2:** Validates whether summary data is something the owner looks at.
*   **Depends on:** Feature 7.
*   **Open questions:** Useful without revenue?
*   **Maps to:** Secondary signal for the "uses daily" metric.
* * *

## Feature count summary

| Priority | Count | Features |
| ---| ---| --- |
| P0 | 9 | 0, 1, 2, 3, 4, 5, 7, 8, 14 |
| P1 | 4 | 6, 9, 10, 12 |
| P2 | 2 | 11, 13 |

**Total: 15 features.**
* * *

## Sequenced delivery plan

1. **Feature 0 — Infrastructure foundation** (architect's BE hosting ADR first).
2. **Feature 1 — Studio owner authentication** (magic link).
3. **Feature 2 — Studio profile setup** (fixed America/Cancun timezone).
4. **Feature 3 — Therapist roster management.**
5. **Feature 4 — Service catalog management** (parallel with 3; MXN + USD).
6. **Feature 5 — Daily schedule view** (THE SPINE — first user-visible value).
7. **Feature 7 — Manual booking creation.**
8. **Feature 8 — Booking reschedule and cancel.**
9. **Feature 14 — Validation checkpoint** — demo to a real studio BEFORE continuing.
10. **Feature 6 — Therapist availability configuration.**
11. **Feature 9 — Customer record management.**
12. **Feature 10 — Owner booking confirmation email.**
13. **Feature 12 — Upcoming bookings list view.**
14. **Feature 11 — Therapist WhatsApp notifications (P2)** — only if Feature 14 confirms valuable; needs WhatsApp provider ADR first.
15. **Feature 13 — Basic booking summary (P2)** — only if Feature 14 confirms valuable.
* * *

## Risks / what could go wrong

1. **We may be building the wrong thing.** Studio-side pain unvalidated. Mitigation: Feature 14 is sequenced after the core booking loop, not at the end of v1.
2. **The schedule view layout assumption fails.** Daily column-per-therapist is the highest-risk UI assumption. Designer should prototype and ideally show to one real owner before code is written.
3. **Supabase free tier pause** (1 week of inactivity). Architect must document mitigation (keep-alive ping or runbook entry).
4. **Feature creep from "small" requests.** Triage every request against the 90-day metric.
5. **WhatsApp provider complexity (P2).** Meta/Twilio onboarding can take weeks even for outbound-only. Drop entirely from v1 if it blocks.
6. **Brevo 300 emails/day.** Fine for one studio. Flag at multi-studio scale.
7. **Data model inflexibility.** Architect biases toward flexibility while assumptions are unvalidated; document hardcoded assumptions in the first ADR.
8. **Magic-link UX friction.** A non-technical owner relying on email round-trips for every login could be annoying. Mitigation: long-lived sessions (e.g., 30+ days). Revisit at validation checkpoint.