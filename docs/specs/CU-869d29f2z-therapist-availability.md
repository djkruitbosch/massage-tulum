# Spec: Therapist Availability Configuration (Feature 6)

**Ticket:** CU-869d29f2z
**Status:** Draft
**Author:** product-manager (agent), worker-04 lane (research/spec/architecture)
**Date:** 2026-05-17

> **Reading order:** This is the third booking-cluster spec. Read in this
> order: Therapist Roster (CU-869d29f1p) → Studio Profile (CU-869d29f1h) →
> **this spec (CU-869d29f2z)** → Manual Booking (CU-869d29f2c) →
> Reschedule/Cancel (CU-869d29f2d) → Daily Schedule (feature-5).
> This spec is **load-bearing** for the
> `outside_therapist_hours` warning declared in Feature 7 §3.3 #1 and
> mentioned in passing by Feature 5. Until this ships, that warning is
> a documented no-op.

* * *

## 1. Problem

Today the schedule treats every minute of every day as bookable for every
active therapist. In a real Tulum studio the therapists are part-time,
tourism-seasonal, and have wildly different weekly patterns ("I do
Mon/Wed/Fri mornings; Lupe does Tue/Thu evenings and weekends"). The owner
holds those patterns in her head and silently corrects bookings during
manual entry. Two failure modes follow:

1. **Bookings get put on a therapist who doesn't work that day.** The
   owner notices the next morning when the therapist doesn't show up.
   The customer is the one who suffers.
2. **The owner self-rate-limits booking creation** because she can't
   trust the schedule to flag the obvious cases — she over-checks
   WhatsApp before every booking. The "30-second" benchmark from the
   v1 success definition slips.

The roadmap calls Feature 6 **P1** (after the spine of Features 0–5 +
7 + 8 lands) and notes it is **assumption-laden** — a regular weekly
schedule may be the wrong primitive. Spec must commit to weekly as the
minimum useful contract and explicitly defer one-off exceptions until
post-validation (Feature 14).

**Evidence:** No live studio data yet. Pre-validation assumption:
2-therapist studio, each working 4–5 days/week with different patterns.
Feature 14 will revalidate this assumption.

## 2. User stories

1. As a studio owner, I want to configure each therapist's standard
   working hours by weekday — including marking a day as "off" — so
   that the schedule reflects when each therapist actually works.
2. As a studio owner, I want to copy one therapist's weekly schedule as
   a starting point for another (or duplicate from "studio hours") so I
   don't retype the same Monday–Friday pattern seven times for each new
   hire.
3. As a studio owner, I want a soft warning (not a hard block) when I
   create or reschedule a booking outside a therapist's configured
   hours, so I can still accept a late-night session for a hotel guest
   without fighting the form.
4. As a studio owner, I want the daily schedule view to visually
   distinguish each therapist's working window from their non-working
   hours (e.g., shaded background outside hours), so I can scan the day
   without checking the configuration screen.
5. As a studio owner, I want the availability page to load and save
   reliably with inline validation, so the configuration is trustworthy
   the moment I leave the page.
6. As a studio owner, I want changes to availability to take effect
   immediately for new bookings but **never retroactively invalidate or
   modify existing bookings**, so I don't lose data when reorganizing
   schedules.

## 3. Acceptance criteria

Numbered, Given/When/Then, testable. QA writes integration tests
directly from these.

### 3.1 Availability page entry point and empty state

1. Given the owner is authenticated and has at least one active
   therapist, when she navigates to `/studio/availability` (or the
   dashboard "Therapist availability" link), then the page renders a
   list of all therapists (active and inactive, see §3.7) with a
   `Configure` button per row.
2. Given the owner has zero therapists, when she navigates to
   `/studio/availability`, then the page renders an empty state with
   `availability.emptyState.title`, `availability.emptyState.body`, and
   a CTA `availability.emptyState.cta` that links to
   `/studio/therapists`.
3. Each therapist row shows a one-line **weekly summary** derived from
   the configured rows — `availability.summary.format` ("Mon–Fri,
   9:00 AM – 6:00 PM" / "Lun a vie, 9:00 a.m. – 6:00 p.m.") when all
   open days share one open and one close time; otherwise the literal
   list of weekday abbreviations with hours per day (`availability.summary.byDay`).
4. Each therapist row also shows a status pill: `availability.status.configured` (≥1 weekday is open) or `availability.status.notConfigured` (all 7 weekdays are off / no rows). A therapist with no configured availability does not trigger the F7 warning (see §3.5 #4).

### 3.2 Per-therapist configuration form

1. The form lists 7 weekdays (Monday → Sunday). Each row has: an
   **Off / Working** toggle, an open-time picker, and a close-time picker.
   When the toggle is `Off`, both pickers are disabled and grayed.
2. Time pickers use 12-hour display format (`9:00 AM`, `8:30 PM`).
   Internally values are stored as 24-hour `HH:MM` strings. _(Mirrors
   ADR-0012 / studio_hours behavior — confirm in research §10.)_
3. When a weekday is `Working`, both open and close times are required.
   Submitting either empty surfaces `availability.hours.error.timeRequired`
   inline below the offending row.
4. Close time must be strictly after open time on the same day (no
   overnight ranges in v1; see §4). Equal or earlier close time surfaces
   `availability.hours.error.closeBeforeOpen`.
5. Time pickers snap to **15-minute granularity** (`HH:00`, `HH:15`,
   `HH:30`, `HH:45`). 5-minute granularity is reserved for booking
   start_time (Feature 7); availability windows do not need that
   resolution.
6. The form has two presets, surfaced as buttons above the weekly grid:
   - `availability.preset.copyFromStudio` — pre-fills the 7 weekdays
     from the `studio_hours` table for this studio (the studio's own
     operating hours per CU-869d29f1h). Off days copy as Off.
   - `availability.preset.copyFromTherapist` — opens a sub-picker to
     select another therapist (active or inactive) in this studio and
     copies their availability rows.
   Both presets only **pre-fill the form** — they do not save until the
   owner clicks Save. This lets her tweak before committing.
7. **Save semantics:** all 7 weekday rows are written **atomically** —
   either all 7 persist or none do. The implementation MUST use the
   same atomic-replace pattern as `upsert_studio_hours` (DELETE +
   INSERT in a Postgres function), or an architect-approved equivalent.
   This is a §10 research item only insofar as the architect picks the
   exact mechanism.
8. Successful save returns to the per-therapist row in the list,
   surfaces the success toast `availability.toast.saved`, and refreshes
   the summary line in #3.1 #3.
9. The form's `Cancel` button discards unsaved changes after a
   `availability.cancel.confirmIfDirty` confirmation dialog (only when
   the form is dirty).
10. **A therapist with all 7 weekdays Off is a valid state** (e.g., an
    inactive seasonal therapist). It persists as 7 rows with
    `is_working = false`, NOT as zero rows. The schedule view treats
    this as "no working hours configured" identically to a therapist
    with no rows at all.

### 3.3 Data shape

(Architect owns the final SQL; this is the spec's binding contract.)

1. New table: **`therapist_availability`** (one row per (therapist,
   weekday) pair, 7 rows per configured therapist):
   - `therapist_id uuid not null references public.therapists(id) on delete cascade`
   - `weekday smallint not null check (weekday >= 0 and weekday <= 6)`
     (0 = Monday, 6 = Sunday — match the studio_hours convention from
     CU-869d29f1h)
   - `is_working boolean not null default false`
   - `start_time time null` (NULL when `is_working = false`)
   - `end_time time null` (NULL when `is_working = false`)
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - Constraint: `pk_therapist_availability primary key (therapist_id, weekday)`
   - Constraint:
     `check (
        (is_working = false and start_time is null and end_time is null) or
        (is_working = true  and start_time is not null and end_time is not null and end_time > start_time)
      )`
2. RLS pattern follows ADR-0011 and mirrors `studio_hours` exactly:
   four policies (SELECT, INSERT, UPDATE, DELETE) scoped by joining
   `therapists` → `studio_profiles` → `auth.uid()`. **No DELETE policy
   for owners in v1** if the architect prefers the atomic-replace path
   via Postgres function with `security definer` — research item §10 #3.
3. Soft-delete pattern from CU-869d29f1p (therapist roster) cascades
   here: when a therapist is deactivated (`status = 'inactive'`), her
   `therapist_availability` rows are **kept** (not deleted). They are
   simply not consulted by the booking warning logic (see §3.5 #5).
   This preserves history if she is later reactivated. _Cross-ref:
   therapist-roster spec §4 "Reactivating a therapist: no automatic
   restoration" — that line meant "no automatic restoration of bookings
   that depended on availability," not "delete the availability rows."
   Both specs should be consistent on this point after Gate 1._

### 3.4 API surface (binding contract for architect)

1. `GET /api/therapists/:therapistId/availability`
   - Returns the 7 availability rows (or empty array if none configured).
   - Response shape: `{ rows: [{ weekday, is_working, start_time, end_time }] }`.
   - 404 if `therapistId` is not in the caller's studio.
2. `PUT /api/therapists/:therapistId/availability`
   - Body: `{ rows: [{ weekday: 0..6, is_working: bool, start_time?: "HH:MM", end_time?: "HH:MM" }] }` — exactly 7 rows, one per weekday, no duplicates.
   - Atomic upsert (DELETE + INSERT inside a Postgres function or a
     `WITH` CTE — architect's call; see §10 #3). Returns the saved rows
     on success (mirror `GET` response shape).
   - 400 on shape violations: missing weekday, duplicate weekday,
     missing time fields when `is_working = true`, close ≤ open.
   - 404 if `therapistId` is not in the caller's studio.
3. `GET /api/studios/availability` (optional convenience; architect can
   defer):
   - Returns all therapists' availability rows for the current studio
     in a single call. Used by Feature 5 (Daily Schedule) to render the
     shaded "outside hours" background efficiently. If the architect
     defers, Feature 5 calls #1 N times in parallel — fine at v1 scale
     (≤5 therapists). Mark as "v2 if N > 10."
4. **No DELETE endpoint.** Availability is replaced via `PUT`. To
   "remove" a therapist's availability the owner toggles all 7 days to
   Off (which persists 7 `is_working = false` rows).

### 3.5 Hook into Feature 7 / Feature 8 (booking creation / mutation)

This is the load-bearing section. Feature 7 §3.3 #1 declares:

> If Feature 6 is live and the candidate booking falls outside the
> configured weekly schedule for the selected therapist on that
> weekday, the API returns 200 success but includes
> `warnings: ["outside_therapist_hours"]` in the response.

This spec **fixes the definition of "outside configured weekly schedule":**

1. Define the booking's "weekday" as the day-of-week of `start_time`
   **converted to America/Cancun** (per v1's fixed-timezone decision).
   Use the same `Intl.DateTimeFormat` / Postgres `(start_time AT TIME
   ZONE 'America/Cancun')::date` strategy the bookings research report
   (`docs/research/2026-05-17-bookings-domain.md`) recommends.
2. Define the booking's "in-window" predicate: there exists a row in
   `therapist_availability` for `(therapist_id, weekday(start_time))`
   with `is_working = true` AND
   `start_time_local >= row.start_time` AND
   `end_time_local <= row.end_time`. Both endpoints in America/Cancun
   local time.
3. The booking is considered **outside** the window when either:
   (a) No matching row exists (no availability configured for that
   weekday), OR
   (b) The matching row has `is_working = false`, OR
   (c) The matching row is `is_working = true` but the booking's local
   `[start_time_local, end_time_local)` is not fully contained in
   `[row.start_time, row.end_time)`.
4. **Graceful degradation (per F7 §3.3 #3):** if the therapist has
   **zero rows** in `therapist_availability` (not configured at all),
   the API treats the booking as in-window — the warning does **not**
   fire. This preserves the "Until Feature 6 is shipped, the
   therapist-hours warning is a no-op" guarantee for any therapist who
   hasn't been configured yet.
5. **Deactivated therapists are not selectable in the booking form
   (per F7 §3.1).** This is unchanged; F6 does not relax that.
6. **Reschedule (Feature 8) applies the same warning rule** to the new
   start time. The reschedule endpoint already returns `warnings`
   (per F8 §3.5 #6); this spec extends the set with
   `outside_therapist_hours` once F6 is live.
7. The warning is **non-blocking** in both create and reschedule
   flows. No "force override" toggle in v1; the warning is informational.

### 3.6 Hook into Feature 5 (daily schedule view)

1. Feature 5 already renders a column per active therapist. When F6 is
   live, the column's background renders a **shaded band** outside the
   therapist's configured working window for the selected day,
   distinguished from booked slots visually (designer's call: opacity,
   diagonal stripe, or muted neutral fill).
2. The shaded band is computed entirely client-side from the
   `therapist_availability` payload returned by §3.4 #1 or #3.
3. **If the therapist has no rows configured, no shaded band renders**
   — the column appears as today (fully bookable). This matches §3.5
   #4 and Feature 5's silent fallback in OQ-6.
4. **Cross-spec coordination:** F5's spec PR #118 predates this one.
   This spec MUST NOT require an F5 spec amendment — the shading is an
   additive enhancement that F5's design naturally supports. The
   architect should confirm in the bookings ADR (or a dedicated F5
   amendment) that no migration to F5's data contract is needed.

### 3.7 Configuration UI ordering and visibility

1. The therapist list on `/studio/availability` shows **active
   therapists first**, alphabetically by name (matching F5's ordering
   choice, OQ-6), then inactive therapists below a horizontal divider
   labelled `availability.divider.deactivated`.
2. An inactive therapist's row is rendered with reduced opacity and a
   `availability.row.inactivePill` badge but is fully clickable — the
   owner may still view and edit her saved availability (useful for
   reactivation prep).
3. Editing an inactive therapist's availability persists normally.
   When that therapist is reactivated (via the therapist roster screen),
   her existing rows become live again — no manual reconfiguration.

### 3.8 Validation, save, and error handling

1. The form is dirty whenever any of: a weekday toggle, an open time,
   or a close time differs from the loaded server state. Clean-state
   save is a no-op (no API call; surface `availability.toast.noChanges`).
2. On network failure during save: keep the form open with values
   preserved, surface `availability.toast.error.network`, log the
   failure to Sentry (or whatever the project picked, see CLAUDE.md /
   ADR-0006 if applicable).
3. On 400 from the API: parse the response's per-field errors and
   surface them inline next to the offending row. The API's 400 shape
   MUST include `field` and `weekday` per error.
4. On 404 (therapist not in studio): surface
   `availability.toast.error.notFound` and route back to the list. This
   should be effectively unreachable through normal UI flow but the
   error path exists for tab-switching races.
5. The API enforces, in addition to the per-row validation in §3.4:
   - Exactly 7 rows submitted (no fewer, no more).
   - Each weekday (0..6) appears exactly once.
   Violations return 400 with `error: "invalid_payload_shape"` and a
   descriptive `details` field.

## 4. Out of scope

This feature explicitly does NOT include:

- **One-off exceptions / time-off / sick days.** A therapist's
  availability is the configured weekly schedule, full stop. Per-date
  overrides (e.g., "Lupe is sick on 2026-05-19") are deferred to
  post-validation. _Workaround in v1: the owner avoids creating
  bookings on the affected slot manually; the soft warning will not
  fire because the weekly schedule still says she works._
- **Variable shift patterns (alternating weeks, bi-weekly).** Weekly
  pattern is the only primitive.
- **Overnight working hours** (close < open on same day). Out of scope
  per ADR-0012 / studio_hours convention.
- **Break / lunch windows** within a day (e.g., 9–12 and 1–5). A
  single open/close range per weekday is the contract. Bookings made
  inside a "lunch hour" the therapist takes mentally but didn't model
  will not warn.
- **Service-to-therapist mapping** (which therapists can deliver which
  service). Mentioned in the therapist-roster spec §4 as a separate
  concern; this spec does NOT introduce a service filter on the
  availability page. Booking-time, the therapist picker still lists
  all active therapists regardless of service.
- **Capacity / parallel sessions** (a therapist doing two rooms at
  once). v1 is 1 therapist = 1 booking at a time per F7 §3.2.
- **Therapist availability calendar invite (ICS export, Google Cal
  sync).** Not in v1.
- **Customer-facing visibility of therapist availability.** v1 has no
  customer interface.
- **Bulk "copy this week to next 4 weeks" UI.** Weekly is recurring by
  definition; nothing to bulk-copy.
- **Audit log of availability changes.** Server-side analytics events
  (see §6) cover what we need without a dedicated audit table.
- **Hard block on out-of-hours booking.** v1 is soft warning only,
  per F7 §3.3 #5.

## 5. Edge cases & error states

1. **Therapist deactivated between booking creation and "now."** Her
   existing bookings remain valid. New bookings for her cannot be
   created (deactivated therapists are not selectable, F7 §3.1).
   Availability rows survive deactivation (§3.3 #3).
2. **Therapist reactivated.** Her saved availability rows become live
   again. The owner is not prompted to reconfigure. Toast surfaces in
   the roster screen, not here.
3. **Owner edits availability while a booking modal is open in another
   tab.** The booking modal's draft state is unaffected; only the next
   API call (create or reschedule) will use the new availability for
   the warning evaluation. Last-write-wins on availability (no
   optimistic lock token — single-owner studios per F8 §3.6 #6).
4. **DST.** America/Cancun does not observe DST (UTC-05 year-round
   since 2015-02-01; see research report §R5). No special case.
5. **Booking spans a weekday boundary in local time** (e.g., starts
   23:55, ends 00:25 next day). Spec §3.5 #3 reads the booking's
   start-time weekday only. The portion after midnight is therefore
   not re-checked. This is an accepted simplification in v1; the soft
   warning is informational. Out-of-scope ban on overnight windows
   (§4) means this only matters for unusually long services, none of
   which are in the v1 catalog (max duration 120 min per service-catalog
   spec).
6. **Studio operating hours conflict with therapist hours.** E.g.,
   studio is closed Sunday but the therapist's row says she works
   Sunday 10–14. Both warnings fire independently (F7 §3.3 #4: "if
   both warnings apply, both keys appear in `warnings`"). No
   reconciliation in v1.
7. **Empty payload to `PUT` (zero rows).** Rejected as 400
   `invalid_payload_shape` per §3.8 #5. The "remove all hours" path is
   "7 rows, all `is_working = false`."
8. **Payload with duplicate weekday.** Rejected as 400
   `invalid_payload_shape`.
9. **Payload with weekday outside 0..6.** Rejected as 400
   `invalid_payload_shape`.
10. **Race: two tabs save simultaneously.** Last write wins; the
    atomic DELETE + INSERT inside the upsert function means no
    partial state can persist (§3.2 #7).
11. **Time-zone misconfiguration.** v1 fixed `America/Cancun`. If the
    Supabase Postgres instance returns a session time-zone other than
    UTC, the `AT TIME ZONE 'America/Cancun'` conversion is still
    deterministic — `timestamptz` is always UTC at storage. No
    special handling. (Architect: confirm in the bookings ADR.)
12. **Owner uses `Cancel` with unsaved changes after a confirm
    dialog.** All form state is discarded; loaded server state is
    restored. No autosave.

## 6. Analytics & success metrics

Server-side from NestJS (mirror service-catalog spec §6 / studio-profile
spec §6).

| Event | Properties | When fired |
|---|---|---|
| `availability_page_viewed` | `studio_id`, `therapist_count: int` | Owner navigates to `/studio/availability` |
| `availability_therapist_opened` | `studio_id`, `therapist_id`, `had_existing_rows: bool` | Owner opens a therapist's per-day form |
| `availability_preset_used` | `studio_id`, `therapist_id`, `preset: 'studio' \| 'therapist'`, `source_therapist_id?: uuid` | Owner clicks one of the preset buttons |
| `availability_saved` | `studio_id`, `therapist_id`, `working_days_count: 0..7`, `had_existing_rows: bool` | Successful `PUT` |
| `availability_save_failed` | `studio_id`, `therapist_id`, `error_code` | Non-success response |
| `booking_warning_fired` | `studio_id`, `therapist_id`, `warning: 'outside_therapist_hours'`, `flow: 'create' \| 'reschedule'` | Booking API attaches `outside_therapist_hours` to `warnings` (emit from F7/F8 path, but defined here so analytics owns it) |

`fields_changed` lists field names only — never values (PII).

**Success metric:** within 30 days of F6 launch, ≥ 80 % of active
therapists in the live studio have at least one configured working day
(i.e., the configuration is *adopted*, not just shipped). And separately:
the share of `outside_therapist_hours` warnings on created bookings is
trackable — if it stays high (e.g., > 20 %) the warning's signal is
weak and the assumption-laden "weekly schedule is the right primitive"
hypothesis is worth revisiting at Feature 14.

## 7. Roles & permissions

- **Studio owner (only role in v1).** Full read/write on the rows for
  therapists in her own studio. RLS via the same join pattern as
  `therapists` and `studio_hours` (no `owner_id` column on the
  `therapist_availability` table; ownership flows through
  `therapists.studio_id` → `studio_profiles.owner_id = auth.uid()`).
- **Therapist:** no login in v1; cannot view or edit her own
  availability.
- **Customer:** no login in v1; cannot view availability.

RLS policies follow the canonical pattern in ADR-0011 + mirrored from
`studio_hours` (CU-869d29f1h architecture doc). The architect MUST
include both `USING` and `WITH CHECK` on the UPDATE policy (same as
F8's note in §7 of the booking-mutations spec). Test coverage required:
`rls_therapist_availability_test.sql` parallel to
`rls_studio_hours_test.sql`.

## 8. Localization

All user-facing strings are bilingual (es-canonical, en parallel). i18n
key naming follows the project pattern (camelCase under feature
namespace).

Locale-dependent rendering:
- Weekday names: `availability.hours.day.{monday..sunday}` (the same
  keys studio-profile uses; reuse rather than duplicate — see §10 #2).
- Time pickers: 12-hour display, locale-formatted via
  `Intl.DateTimeFormat` (research report R3). Internal storage is
  `HH:MM` 24-hour.
- Summary line: composed by client-side `Intl.ListFormat` for the
  weekday-abbreviation case; pure i18n key for the "Mon–Fri, 9–6" common
  case.

Required new keys (non-exhaustive — designer + FE owner will finalize):

```
availability.page.title                       es: "Disponibilidad de terapeutas"   en: "Therapist availability"
availability.page.subtitle                    es: "Define el horario semanal de cada terapeuta."  en: "Set each therapist's weekly schedule."
availability.emptyState.title                 es: "Aún no tienes terapeutas"        en: "No therapists yet"
availability.emptyState.body                  es: "Agrega un terapeuta antes de configurar su disponibilidad."  en: "Add a therapist before configuring availability."
availability.emptyState.cta                   es: "Agregar terapeuta"               en: "Add therapist"
availability.summary.format                   es: "{daysRange}, {openTime} – {closeTime}"  en: "{daysRange}, {openTime} – {closeTime}"
availability.summary.byDay                    es: "Ver detalle por día"             en: "View detail by day"
availability.status.configured                es: "Configurado"                     en: "Configured"
availability.status.notConfigured             es: "Sin configurar"                  en: "Not configured"
availability.action.configure                 es: "Configurar"                      en: "Configure"
availability.action.save                      es: "Guardar disponibilidad"          en: "Save availability"
availability.action.cancel                    es: "Cancelar"                        en: "Cancel"
availability.preset.copyFromStudio            es: "Copiar horario del estudio"      en: "Copy from studio hours"
availability.preset.copyFromTherapist         es: "Copiar de otro terapeuta"        en: "Copy from another therapist"
availability.preset.picker.title              es: "¿De qué terapeuta?"              en: "From which therapist?"
availability.row.label.working                es: "Trabajando"                      en: "Working"
availability.row.label.off                    es: "Descanso"                        en: "Off"
availability.row.startTime.label              es: "Inicio"                          en: "Start"
availability.row.endTime.label                es: "Fin"                             en: "End"
availability.row.inactivePill                 es: "Desactivado"                     en: "Inactive"
availability.divider.deactivated              es: "Terapeutas desactivados"         en: "Inactive therapists"
availability.cancel.confirmIfDirty            es: "Tienes cambios sin guardar. ¿Descartarlos?"  en: "You have unsaved changes. Discard them?"
availability.toast.saved                      es: "Disponibilidad guardada."        en: "Availability saved."
availability.toast.noChanges                  es: "No hay cambios para guardar."    en: "No changes to save."
availability.toast.error.network              es: "No se pudo guardar. Intenta de nuevo." en: "Couldn't save. Try again."
availability.toast.error.notFound             es: "Terapeuta no encontrado."        en: "Therapist not found."
availability.hours.error.timeRequired         es: "Ingresa la hora de inicio y fin." en: "Enter both start and end times."
availability.hours.error.closeBeforeOpen      es: "La hora de fin debe ser posterior a la de inicio." en: "End time must be after start time."
availability.hours.error.invalidPayload       es: "Datos inválidos. Recarga la página." en: "Invalid data. Reload the page."
```

Reuse from existing namespaces (DO NOT duplicate):
- Weekday names: `studioProfile.hours.day.{monday..sunday}` (or
  promote to a shared `common.weekday.*` namespace — designer's call,
  Gate 1 question §9 #6).

Booking-side warning string (already declared by F7 §8, listed here
for completeness): `bookings.toast.warning.outsideTherapistHours`.

## 9. Open questions for human review

Gate 1 decisions. Each has a recommendation; the human can confirm or
override.

1. **Weekday = 0-indexed Monday or 0-indexed Sunday?**
   Recommendation: **0 = Monday, 6 = Sunday** to mirror `studio_hours`
   (CU-869d29f1h). Consistency wins over JS conventions; the FE maps
   to whatever JS `getDay()` returns.

2. **Granularity for availability start/end times: 15 or 30 minutes?**
   Recommendation: **15 minutes.** Booking start_time is 5-min granular
   (F7 §3.1), so availability can be coarser without forcing
   off-boundary booking checks. 30 min feels too coarse for a 9:15
   spa opening.

3. **Default for a brand-new therapist row: "all 7 Off" or "copy
   studio hours"?**
   Recommendation: **All 7 Off.** Forces the owner to do an explicit
   step (avoids the warning silently never firing because the studio's
   hours were auto-copied and "look right"). The copy-from-studio
   preset is one click away.

4. **Where does the availability page live in the dashboard nav?**
   Recommendation: **`/studio/availability` as a sibling of
   `/studio/therapists`**, with a "Configure availability" link from
   each therapist row on the therapist roster page. Two entry points,
   one canonical destination.

5. **Should presets pre-fill open `is_working = true` rows from a
   source that has all-Off?**
   Recommendation: **Yes, copy verbatim including the Offs.** The
   preset is "make this match X exactly" — if X is all-Off the owner
   wants a starting point that says "she also doesn't work weekends."

6. **Reuse `studioProfile.hours.day.*` keys, or create
   `common.weekday.*`?**
   Recommendation: **Promote to `common.weekday.*` in a small refactor
   PR alongside this feature.** Weekday names will be needed by the
   daily schedule (F5) and any future calendar UI; centralizing now
   costs ≤ 1h. Defer if dev capacity is tight.

7. **Visual treatment of "outside hours" shading on the schedule
   (F5).** Recommendation: defer to **designer** (this is a UI spec
   call, not a product call). Spec only commits to "visually distinct"
   per §3.6 #1.

8. **Does the same warning fire on F8 reschedule when
   `outside_studio_hours` was already present in the *old* slot?**
   Recommendation: **Yes — evaluate the new slot against current
   availability, ignore the old slot's warnings.** The reschedule
   warning set is computed fresh for the new slot.

9. **Should the warning analytics event `booking_warning_fired` be
   emitted once per warning key (one event per key) or once per
   booking (with `warnings: ['a', 'b']` as a property)?**
   Recommendation: **One event per warning key.** Easier to count "how
   often does outside_therapist_hours fire" without splitting a
   compound event. Mirrors the F8 cancel/reschedule pattern of one
   event per discrete action.

10. **Status pill in §3.1 #4: is "Not configured" === "all 7 Off"?**
    Recommendation: **Yes.** Both are functionally equivalent for the
    warning logic (§3.5 #4). UI says "Not configured" to nudge the
    owner toward action; the data layer doesn't distinguish.

## 10. Research needed

Forwarded to the `researcher` agent. Most items are 1-paragraph answers
the architect can also field directly; flagged here for completeness.

1. **`time` type vs `text` for storing 24-hour `HH:MM`.** The
   studio_hours table uses `time without time zone` (per its migration
   in CU-869d29f1h architecture doc). Confirm parity. If the architect
   wants `text` for FE-mapping simplicity, document why. *Likely
   answer:* keep `time`; FE serializes `HH:MM` via a tiny helper.

2. **Reuse of `studioProfile.hours.day.*` i18n keys.** Confirm the
   project's convention — is shadow-using another feature's keys
   acceptable, or must every spec own its strings? Likely the project
   already has a `common.*` namespace (or should). Worth a quick scan
   of `apps/web/messages/` before the FE work starts.

3. **Atomic upsert mechanism.** Mirror `upsert_studio_hours` Postgres
   function (DELETE + INSERT inside a `security definer` function with
   `studio_id` permission check)? Or use a `WITH` CTE in plain SQL via
   the Supabase service-role client? Architect picks; researcher can
   confirm Supabase function deployment ergonomics haven't changed
   since CU-869d29f1h shipped.

4. **`Intl.DateTimeFormat` for 12-hour `HH:MM` rendering across
   locales.** Confirm `'es-MX'` uses `9:00 a.m.` (lowercase a.m./p.m.
   with periods) — relevant for the summary line. The bookings
   research report (`docs/research/2026-05-17-bookings-domain.md` §R3)
   already covered this for `start_time`; reconfirm for time-only
   `HH:MM` rendering.

5. **Performance of the `outside_therapist_hours` evaluation in
   Postgres.** The eval reads at most 1 row per booking from
   `therapist_availability` (PK on `(therapist_id, weekday)`). No
   index changes needed. Worth a one-line confirmation from the
   architect that the booking-create transaction now does +1 indexed
   read (negligible).

6. **F5 background shading data flow.** Decide between (a) F5 fetches
   `/api/studios/availability` once per day load and computes shading
   locally; (b) F5 inlines availability into the schedule payload
   server-side. Recommendation: (a), to keep the schedule payload lean
   and the availability cache shareable across day navigations.

## 11. Cross-references

- **Roadmap:** Feature 6 (P1, M, assumption-laden).
- **Upstream specs (must be on main before BE-1 of this lands):**
  - CU-869d29f1f — Studio Owner Auth
  - CU-869d29f1h — Studio Profile (`studio_hours` is the data-shape
    precedent and the `copy from studio` preset's source)
  - CU-869d29f1p — Therapist Roster (provides
    `therapists.studio_id` + `status` filter)
- **Downstream consumers:**
  - CU-869d29f2c — Manual Booking Creation (Feature 7 §3.3 #1 — this
    spec closes the contract)
  - CU-869d29f2d — Booking Reschedule/Cancel (Feature 8 §3.5 #6 — same)
  - feature-5-daily-schedule-view — Daily Schedule (Feature 5 §3.6 — F5
    consumes availability for background shading; F5 design accommodates
    this without an amendment per §3.6 #4)
- **ADRs:**
  - ADR-0010 (price snapshot invariant) — informational, not modified.
  - ADR-0011 (Supabase RLS canonical pattern) — followed.
  - ADR-0012 (business hours time storage) — followed.
  - A new ADR may be drafted by the architect at her discretion if the
    upsert mechanism (§3.4 #2) deviates from `upsert_studio_hours`.
- **Research:** `docs/research/2026-05-17-bookings-domain.md` §R3, §R5.

## 12. Implementation sequencing hint (for the architect)

Not binding, but the work cleanly fits this order:

1. **Migration:**
   `20260518000001_create_therapist_availability.sql` — table, PK, CHECK
   constraint, FK to therapists with `on delete cascade`.
2. **Migration:**
   `20260518000002_rls_therapist_availability.sql` — 4 policies via
   `therapists` → `studio_profiles` → `auth.uid()` join. Mirror
   `rls_studio_hours_test.sql` pattern in CI.
3. **Migration:**
   `20260518000003_upsert_therapist_availability_fn.sql` — `security
   definer` function `public.upsert_therapist_availability(p_therapist_id,
   p_rows jsonb)` enforcing studio ownership.
4. **NestJS module `therapist-availability/`** — controller (2
   endpoints), service, DTOs. Mount under existing `therapists/` module
   namespace (`/api/therapists/:id/availability`) for URL coherence.
5. **Wire the warning evaluation** into the existing bookings service:
   one new private method `evaluateAvailabilityWarning(booking)` called
   inside `createBooking` and `rescheduleBooking`. Append
   `outside_therapist_hours` to the `warnings` array when applicable.
   Existing unit tests for the bookings module need a few new cases
   per §3.5 #1–4.
6. **Next.js page** `/studio/availability/page.tsx` — server-rendered
   list with a server action wrapping `GET /api/studios/availability`
   (or N parallel `GET`s if the architect deferred §3.4 #3).
7. **Next.js modal** for per-therapist editing — client component
   (form state, time pickers, preset buttons), uses a server action
   that wraps `PUT /api/therapists/:id/availability`.
8. **Feature 5 amendment** — F5's schedule view picks up
   `/api/studios/availability` and renders the shaded band (§3.6).
   Spec amendment NOT required if the existing F5 design supports a
   per-column background prop; confirm with the F5 author (DJmain).
9. **i18n keys** — add `availability.*` namespace; optionally promote
   `studioProfile.hours.day.*` to `common.weekday.*` (see §9 #6).
10. **QA test plan** — integration tests covering every G/W/T in §3.
    Add `rls_therapist_availability_test.sql` parallel to
    `rls_studio_hours_test.sql`.

* * *

**End of spec.**

This spec, together with the bookings research report
(`docs/research/2026-05-17-bookings-domain.md`) and CU-869d29f2c /
CU-869d29f2d (F7 / F8), gives the architect a complete contract for
authoring the bookings-cluster ADR in one pass. Feature 6 is the last
P0/P1 spec required for the daily-schedule spine (F5) to stop having
silent fallbacks.
