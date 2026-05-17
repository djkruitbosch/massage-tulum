# Spec — Manual Booking Creation

**Ticket:** [CU-869d29f2c](https://app.clickup.com/t/869d29f2c)
**Status:** Draft (awaiting Gate 1 approval)
**Author:** worker-04 (product-manager mode)
**Date:** 2026-05-16
**Roadmap reference:** v1 Roadmap §"Feature 7: Manual booking creation" (P0)

* * *

## 1. Problem

A Tulum studio owner today books every session manually — a customer messages on WhatsApp, the owner mentally checks who's free, scribbles the slot in a notebook or replies "ok, confirmed" without writing it anywhere durable. There is no canonical store of "this therapist has this customer booked at this time for this service." Every downstream feature in v1 — the daily schedule (Feature 5), reschedule/cancel (Feature 8), confirmation email (Feature 10), upcoming list (Feature 12), summary (Feature 13) — assumes that store exists.

This feature is the only data-entry path for booking records in v1. Without it the schedule is permanently empty and v1 has no value. It is also the explicit precondition for the 90-day success metric: "ONE real Tulum studio uses the app daily to manage their bookings."

Primary user: the **studio owner** (single-account-per-studio in v1).
Secondary impact: therapists (named on bookings, no login); customers (referenced on bookings, no portal).

Frequency: a small Tulum studio with two therapists books ~6–14 sessions/day, so the booking-create path is the second-most-used screen after the daily schedule itself. Any friction here compounds.

* * *

## 2. User stories

1. As a studio owner, I want to create a booking by selecting a therapist, a service, a date, and a start time, so a single time-block appears on the schedule and the customer record updates.
2. As a studio owner, I want to attach a customer to the booking — either by selecting an existing customer (Feature 9 — see §4) or by typing a new customer's name + phone inline — so I don't context-switch to a separate "customers" screen mid-booking.
3. As a studio owner, I want the system to refuse to double-book the same therapist on overlapping time slots, so I never accidentally promise the same person to two customers.
4. As a studio owner, I want the system to warn (but not block) me when I create a booking outside the therapist's configured working hours (Feature 6) or outside studio operating hours (Feature 2), so I can still accept a one-off late-night session without fighting the form.
5. As a studio owner, I want the booking's end time to be auto-derived from the service's duration, so I never have to add minutes in my head.
6. As a studio owner, I want the booking to capture the price snapshot at creation time (per ADR-0010) so that future edits to the service price don't rewrite history.
7. As a studio owner, I want the new booking to appear instantly on the daily schedule view without a manual refresh, so I can confirm the slot is reserved before the customer messages me back.

* * *

## 3. Acceptance criteria

### 3.1 Form fields and validation

1. The "New booking" form (modal or page — designer's call) exposes exactly these fields:
   - **Therapist** (required) — select from the studio's `active` therapists only. Deactivated therapists never appear in the picker.
   - **Service** (required) — select from the studio's `active` services only. Inactive services never appear in the picker.
   - **Date** (required) — date-only field, owner-local (America/Cancun) calendar day.
   - **Start time** (required) — time-only field, 5-minute granularity (`HH:00`, `HH:05`, …, `HH:55`). Stored in UTC; displayed in America/Cancun (per the v1 fixed-timezone decision).
   - **Customer** (required) — combobox: either select an existing customer (by name or phone substring match) or open the inline "new customer" sub-form with `name` (required, 1–120 chars) and `phone` (required, 5–20 chars; Mexican phone validation per the open question in Feature 2's research). Notes optional (0–500 chars).
   - **Booking notes** (optional, 0–500 chars) — owner-internal note specific to this booking, e.g. "first-timer", "back pain in cervical area." Distinct from customer notes.
   - **Currency** (required, see §3.5) — `MXN` or `USD`. Default sourced from the most recently created booking in this studio (or `MXN` if none).
   - **Price** (required, integer ≥ 0) — pre-filled from the service's `base_price_mxn` when `currency = MXN`; pre-filled to `0` (and visibly editable) when `currency = USD`. The owner may override at booking time; whatever value is on the form at submit is what gets snapshotted (per ADR-0010).
2. **End time** is **computed**, not entered: `end_time = start_time + service.duration_minutes`. Render it as a read-only preview next to the start-time field ("Ends at 11:30").
3. Submitting with any required field empty → inline error using the corresponding `bookings.form.<field>.error.required` key. No API call.
4. `start_time` not on a 5-minute boundary (direct-API attempt) → 422 `{ "error": "invalid_start_time_granularity" }`. The UI's time picker should not allow off-boundary input, so this is a guard against direct-API misuse only.
5. `price` < 0 → `bookings.form.price.error.negative`. `price` = 0 is valid (complimentary / package session).
6. `notes` > 500 → `bookings.form.notes.error.maxLength`.

### 3.2 Availability validation

1. Given a candidate booking `{therapist_id, start_time, end_time}`, the API rejects it if there exists any other booking for the same `therapist_id` with `status ∈ {confirmed, pending}` whose `[start_time, end_time)` overlaps the candidate's `[start_time, end_time)`. Two bookings that share only an endpoint (one ends at 10:00, the next starts at 10:00) are **not** considered overlapping.
2. On overlap, the API returns 409 `{ "error": "therapist_double_booked", "conflicting_booking_id": "..." }`. The UI surfaces `bookings.toast.error.doubleBooked`, shows the conflicting booking's start/end time + customer name in the inline error region, and keeps the form open with all entered values preserved.
3. **Cancelled bookings (`status = cancelled`) never block a new booking on the same slot.** They are visible on the schedule only as a separate visual state — see Feature 8.
4. The overlap check is performed server-side using a Postgres exclusion constraint (architect's call: `EXCLUDE USING GIST` with `tstzrange` and a `WHERE status IN ('confirmed','pending')` predicate, or an explicit transactional pre-check). RLS-bound: the constraint applies within a studio's rows only.

### 3.3 Soft warnings (non-blocking)

1. **Outside therapist working hours (Feature 6):** if Feature 6 is live and the candidate booking falls outside the configured weekly schedule for the selected therapist on that weekday, the API returns 200 success but includes `warnings: ["outside_therapist_hours"]` in the response. The UI shows a non-blocking inline notice on the schedule entry (toast: `bookings.toast.warning.outsideTherapistHours`).
2. **Outside studio operating hours (Feature 2):** same pattern — `warnings: ["outside_studio_hours"]`, non-blocking, surface as `bookings.toast.warning.outsideStudioHours`.
3. Until Feature 6 is shipped, only the studio-hours warning fires. The therapist-hours warning is a no-op (the array is omitted).
4. If both warnings apply, both keys appear in `warnings`. The UI may consolidate them visually but must surface both.
5. The owner has no in-form "override / dismiss" toggle; the warning is informational only. Hard block is reserved for the double-book case (§3.2).

### 3.4 Customer attachment

1. The customer combobox supports:
   - **Select existing:** substring-search on `customers.name` and `customers.phone` (case-insensitive, accent-insensitive for `name`). Returns up to 10 matches. Cleared search shows the 5 most recently booked customers.
   - **Create new inline:** if the owner types a value with no matches, a "+ Create new customer" affordance appears. Submitting the booking with this option performs both the customer INSERT and the booking INSERT in a single transaction (server-side). On rollback (any error after partial work), neither persists.
2. **Duplicate handling:** if the entered new-customer phone exactly matches an existing customer for this studio, the API returns 409 `{ "error": "customer_phone_exists", "existing_customer_id": "..." }` and the UI offers the owner the existing record. Customer name match alone never triggers a 409 (homonyms are normal).
3. Feature 9 (customer record management as a standalone screen) is P1 and will not ship at the same time as this spec. The booking-create flow MUST work without Feature 9 — meaning the inline "new customer" sub-form is sufficient to land Feature 7 alone.
4. Selecting an existing customer attaches the booking via `customer_id` FK only; the booking does not denormalize customer name/phone.

### 3.5 Currency at booking time

The roadmap (§"Decided product questions 2026-04-26") says v1 supports both MXN and USD, and the spec must decide whether currency is per-service or per-booking. The service-catalog spec stores only `base_price_mxn`. Therefore:

1. Currency is **per booking, not per service.** The service catalog provides a price hint (in MXN); the booking captures the final currency + amount the owner agreed with the customer.
2. The booking row stores `currency` (text, `'MXN'` or `'USD'`) and `price_snapshot` (integer ≥ 0, in the **minor unit of the chosen currency** — pesos for MXN, dollars for USD; both whole-unit per v1's no-fractional-currency rule from the service-catalog spec).
3. The form's default currency is the most recently used currency in this studio's bookings, falling back to `MXN`.
4. When `currency = USD`, the form does NOT pre-fill from the service's MXN price (a naive ÷20 conversion would be misleading). The owner enters the USD amount explicitly. The UI shows a hint: `bookings.form.price.hintUsd` ("Service MXN price: {mxnPrice} — enter the USD amount agreed with the customer").
5. When `currency = MXN`, the price defaults to `service.base_price_mxn` and is editable.
6. No FX conversion is performed anywhere. The booking is denominated in whatever currency the owner picked at creation time and stays there forever.
7. Editing currency on an existing booking is **out of scope for v1** (see §4); a wrong-currency booking must be cancelled and recreated.

### 3.6 Status lifecycle

1. New bookings are created with `status = confirmed`. There is no `pending` state introduced by this spec — `pending` is reserved for a future v2 customer-initiated booking flow. The schema column accepts `confirmed`, `cancelled`, and (preserved for the future) `pending`, but Feature 7 only ever writes `confirmed`.
2. Status transitions to `cancelled` and reschedule-edit-in-place are owned by Feature 8 and are out of scope here.

### 3.7 Schedule integration

1. After a successful POST, the FE invalidates the daily-schedule query for the booking's date and the new block appears within ≤2 seconds without a manual refresh (Next.js mutation revalidation, mechanism is the developer's call).
2. If the user navigates to a different date than the one they booked, no automatic redirect occurs (the owner stays where they were); a toast confirms the booking date.

### 3.8 Authorization

1. Any booking endpoint request for a `therapist_id`, `service_id`, or `customer_id` not belonging to the authenticated owner's studio → 403. Enforced at Supabase RLS via the same studio-scoped pattern (ADR-0011) as services and therapists.
2. Unauthenticated request → 401.
3. The architect must confirm RLS policies cover the booking-customer transaction (§3.4 #1): if a customer is created inside the booking transaction, the customer INSERT must also satisfy the studio-scoped policy.

### 3.9 Analytics (server-side)

See §6. All events fire from NestJS, never from the browser.

* * *

## 4. Out of scope

- **Booking reschedule and cancel** — Feature 8 (separate spec). This spec does not introduce any path to mutate an existing booking.
- **Customer record management screen (standalone CRUD)** — Feature 9, P1, future spec. The inline new-customer sub-form is sufficient to land Feature 7.
- **Therapist availability configuration** — Feature 6, P1. This spec assumes availability data may or may not exist; the warning logic degrades gracefully when it doesn't (§3.3 #3).
- **Booking confirmation emails** — Feature 10, P1. Out of band.
- **Therapist WhatsApp notifications** — Feature 11, P2. Out of band.
- **Recurring bookings / standing weekly appointments.** Each booking is a single discrete record.
- **Multi-therapist / couples bookings.** v1 assumption #6 in the roadmap: sessions are atomic (one therapist, one customer, one slot).
- **Group classes / capacity > 1.** Same as above.
- **Public / customer-facing booking flow.** Customer self-booking is v2+ per roadmap "Out of scope for v1."
- **Payment capture or invoicing.** Stripe is v2+. Price snapshot is purely a record of what was agreed verbally.
- **Fractional currency units** (centavos, cents). Service-catalog spec established whole-unit-only; this spec inherits that.
- **FX conversion** between MXN and USD. Per §3.5 #6.
- **Currency edit on an existing booking.** Per §3.5 #7.
- **Past-date bookings beyond 90 days.** The Date picker may permit historical bookings (for retroactive entry, e.g. "I forgot to log yesterday's session"), but bookings dated more than 90 days in the past are rejected by API: 422 `{ "error": "booking_too_far_in_past" }`. This guards against accidental year-typos. Future-date limit is 365 days; same error key `booking_too_far_in_future`.
- **Drag-to-create on the schedule.** Owner creates via the form only in v1. The schedule view (Feature 5) is read-only-with-a-CTA.
- **Editing a booking's customer attachment** after creation. Cancel + recreate is the v1 path.

* * *

## 5. Edge cases and error states

- **Service deactivated between picker load and form submit.** API double-checks `services.status = 'active'` at submit time. On mismatch → 422 `{ "error": "service_inactive" }`. Refresh the picker.
- **Therapist deactivated between picker load and form submit.** Same pattern → 422 `{ "error": "therapist_inactive" }`.
- **Therapist deleted (hard delete) mid-flow.** Per the roster spec, hard delete is API-only and blocked for therapists with bookings; for therapists with zero bookings the API may permit it. If the picker held a stale id → 422 `{ "error": "therapist_not_found" }`.
- **Customer deleted mid-flow** — out of scope; v1 has no customer delete endpoint.
- **DST.** America/Cancun does **not** observe DST (UTC-05 year-round); this is a deliberate v1 simplification. Document this assumption in the architecture layer so the future multi-timezone work (v2+) does not silently inherit it.
- **Concurrent overlap race.** Two owners (or one owner across two tabs) submit overlapping bookings within milliseconds. The Postgres exclusion constraint (or equivalent transactional check) MUST serialize: exactly one INSERT succeeds, the other returns 409. The UI surface is the same as §3.2 #2.
- **Whitespace-only customer name** → treated as empty → required-error.
- **5-minute boundary** — the picker rounds 11:07 to the nearest snap (`11:05` or `11:10`); choice is the designer's. The API rejects off-boundary anyway (§3.1 #4).
- **Network failure on submit.** Form retains all entered data; show `toast.error.network`. No optimistic update — wait for server confirmation before showing the block on the schedule.
- **API returns `warnings` array unknown to the client.** UI ignores unknown keys (forward-compatibility for new warning types in future specs).
- **Booking spans midnight (e.g. 23:30 start, 60-minute service).** Permitted. The schedule view's behavior for cross-midnight blocks is Feature 5's concern; the booking record itself just has `end_time > start_time` and that's the only invariant.
- **Booking exactly equal to therapist's working-hours boundary.** Treated as inside the working hours (closed-open `[start, end)` convention).
- **Empty therapist roster or empty service catalog.** The "New booking" CTA is disabled with explanatory copy: `bookings.form.cta.disabled.noTherapists` or `bookings.form.cta.disabled.noServices`.

* * *

## 6. Analytics and success metrics

| Event | Properties | When fired |
| --- | --- | --- |
| `booking_created` | `studio_id`, `booking_id`, `therapist_id`, `service_id`, `customer_id`, `is_new_customer: bool`, `currency`, `price_snapshot`, `duration_minutes`, `lead_time_hours: number` (booking start − now, in hours; negative for retroactive entries), `warnings: string[]` | After successful INSERT (and customer INSERT, if any), inside the same DB transaction's commit hook or immediately after |
| `booking_create_blocked` | `studio_id`, `therapist_id`, `service_id`, `reason: 'therapist_double_booked' \| 'service_inactive' \| 'therapist_inactive' \| 'customer_phone_exists' \| 'booking_too_far_in_past' \| 'booking_too_far_in_future' \| 'invalid_start_time_granularity'` | On API 409 / 422 |
| `booking_form_opened` | `studio_id`, `entry_point: 'schedule_cta' \| 'empty_schedule_cta'` | On modal open |
| `booking_form_abandoned` | `studio_id`, `fields_filled: string[]`, `time_in_form_seconds: number` | On modal close without successful submit |

All server-side except `booking_form_opened` and `booking_form_abandoned`, which are client-emitted (architect to decide whether to proxy them through a BE endpoint or accept analytics from FE directly — note the spec is agnostic).

Never log: customer name, customer phone, booking notes. Use ids only.

**Success metrics**

- **Primary (binds to the 90-day metric):** ≥1 active studio creates ≥3 bookings/day for ≥5 of 7 consecutive days within their first 14 days of use.
- **Secondary:** booking_create_blocked rate < 10% of booking_form_opened (a high block rate signals the form is fighting the owner — typically a granularity, picker, or warning-vs-error misjudgment).
- **Health check:** zero `invalid_start_time_granularity` events traceable to UI in 30-day rolling window (confirms the time picker never offers off-boundary values).

* * *

## 7. Roles and permissions

- **Studio owner only.** Full create access on bookings + customers in their studio.
- **Therapist:** no login, no API access in v1. Their name appears on a booking; they cannot read or write the row.
- **Customer:** no access.

**RLS pattern (ADR-0011, mirrors services and therapists):**

```sql
-- bookings
studio_id IN (
  SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
)

-- customers (transactional partner per §3.4 #1)
studio_id IN (
  SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
)
```

Both tables follow the same studio-scoped pattern. Apply to SELECT/INSERT/UPDATE; DELETE is not exposed in v1 for either.

* * *

## 8. Localization

All new keys under `bookings.*` and `customers.inline.*` (the inline new-customer sub-form). `es` is canonical; `en` parallel.

```python
bookings.form.title.create                     es: "Nueva reserva"                              en: "New booking"
bookings.form.cta.create                       es: "Crear reserva"                              en: "Create booking"
bookings.form.cta.disabled.noTherapists        es: "Agrega un terapeuta antes de reservar"     en: "Add a therapist before creating a booking"
bookings.form.cta.disabled.noServices          es: "Agrega un servicio antes de reservar"      en: "Add a service before creating a booking"
bookings.form.therapist.label                  es: "Terapeuta"                                  en: "Therapist"
bookings.form.therapist.placeholder            es: "Selecciona un terapeuta"                    en: "Select a therapist"
bookings.form.therapist.error.required         es: "Selecciona un terapeuta"                    en: "A therapist is required"
bookings.form.service.label                    es: "Servicio"                                   en: "Service"
bookings.form.service.placeholder              es: "Selecciona un servicio"                     en: "Select a service"
bookings.form.service.error.required           es: "Selecciona un servicio"                     en: "A service is required"
bookings.form.date.label                       es: "Fecha"                                      en: "Date"
bookings.form.date.error.required              es: "Selecciona una fecha"                       en: "A date is required"
bookings.form.startTime.label                  es: "Hora de inicio"                             en: "Start time"
bookings.form.startTime.error.required         es: "Selecciona una hora"                        en: "A start time is required"
bookings.form.endTime.preview                  es: "Termina a las {endTime}"                    en: "Ends at {endTime}"
bookings.form.customer.label                   es: "Cliente"                                    en: "Customer"
bookings.form.customer.placeholder             es: "Busca por nombre o teléfono"                en: "Search by name or phone"
bookings.form.customer.empty                   es: "Sin resultados"                             en: "No matches"
bookings.form.customer.createNew               es: "+ Crear nuevo cliente"                      en: "+ Create new customer"
bookings.form.customer.error.required          es: "Selecciona o crea un cliente"               en: "Select or create a customer"
bookings.form.currency.label                   es: "Moneda"                                     en: "Currency"
bookings.form.currency.option.mxn              es: "Pesos (MXN)"                                en: "Pesos (MXN)"
bookings.form.currency.option.usd              es: "Dólares (USD)"                              en: "Dollars (USD)"
bookings.form.price.label                      es: "Precio acordado"                            en: "Agreed price"
bookings.form.price.hintUsd                    es: "Precio MXN del servicio: {mxnPrice}. Ingresa el monto en USD acordado con el cliente." en: "Service MXN price: {mxnPrice}. Enter the USD amount agreed with the customer."
bookings.form.price.error.negative             es: "El precio no puede ser negativo"            en: "Price cannot be negative"
bookings.form.notes.label                      es: "Notas de la reserva (internas)"             en: "Booking notes (internal)"
bookings.form.notes.placeholder                es: "Solo visibles para ti"                      en: "Only visible to you"
bookings.form.notes.error.maxLength            es: "Las notas no pueden superar 500 caracteres" en: "Notes cannot exceed 500 characters"
bookings.toast.created                         es: "Reserva creada"                             en: "Booking created"
bookings.toast.error.doubleBooked              es: "Este terapeuta ya tiene una reserva que se traslapa con esta hora" en: "This therapist already has a booking that overlaps with this time"
bookings.toast.error.serviceInactive           es: "El servicio fue desactivado. Actualiza el catálogo." en: "The service was deactivated. Refresh the catalog."
bookings.toast.error.therapistInactive         es: "El terapeuta fue desactivado."              en: "The therapist was deactivated."
bookings.toast.error.tooFarInPast              es: "La fecha es de hace más de 90 días."        en: "Date is more than 90 days in the past."
bookings.toast.error.tooFarInFuture            es: "La fecha es a más de 365 días en el futuro." en: "Date is more than 365 days in the future."
bookings.toast.warning.outsideTherapistHours   es: "Reserva creada fuera del horario habitual del terapeuta." en: "Booking created outside the therapist's usual hours."
bookings.toast.warning.outsideStudioHours      es: "Reserva creada fuera del horario del estudio." en: "Booking created outside the studio's operating hours."

customers.inline.title                         es: "Nuevo cliente"                              en: "New customer"
customers.inline.name.label                    es: "Nombre"                                     en: "Name"
customers.inline.name.placeholder              es: "Ej. Ana Martínez"                           en: "E.g. Ana Martínez"
customers.inline.name.error.required           es: "El nombre es obligatorio"                   en: "Name is required"
customers.inline.name.error.maxLength          es: "El nombre no puede superar 120 caracteres"  en: "Name cannot exceed 120 characters"
customers.inline.phone.label                   es: "Teléfono"                                   en: "Phone"
customers.inline.phone.placeholder             es: "+52 984 123 4567"                           en: "+52 984 123 4567"
customers.inline.phone.error.required          es: "El teléfono es obligatorio"                 en: "Phone is required"
customers.inline.phone.error.invalid           es: "Ingresa un teléfono válido"                 en: "Enter a valid phone number"
customers.inline.phone.error.duplicate         es: "Ya existe un cliente con este teléfono."    en: "A customer with this phone already exists."
customers.inline.notes.label                   es: "Notas del cliente (opcional)"               en: "Customer notes (optional)"
customers.inline.notes.placeholder             es: "Visibles para ti en futuras reservas"       en: "Visible to you on future bookings"
```

Reuse `toast.error.network` and shared action labels (Save, Cancel) from the existing namespace.

Date and time formatting: `Intl.DateTimeFormat` with `es-MX` / `en-US` locale; America/Cancun timezone hardcoded (per Feature 2 spec). Researcher to confirm the exact `Intl.DateTimeFormat` options for a localized short-date + short-time across both locales — share the conclusion with Feature 5 (DJmain owns Feature 5 spec; cross-link both ways).

Currency formatting via `Intl.NumberFormat`: `{ style: 'currency', currency: 'MXN' | 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }`. `currencyDisplay: 'symbol'` (not `'narrowSymbol'` — Safari < 14.1 compat, per the service-catalog spec).

* * *

## 9. Open questions for human review (Gate 1)

| # | Question | Recommendation | Rationale |
| --- | --- | --- | --- |
| 1 | Currency per-service vs per-booking | **Per-booking** | Service-catalog already shipped MXN-only on the service row. Adding USD to services now would require a migration, an FX policy, and a UI overhaul. Per-booking keeps the catalog unchanged and lets the owner record the actual agreed currency. |
| 2 | Hard block on overlap vs warning + override | **Hard block** | The 30-second-reschedule benchmark in the roadmap implies a trustworthy schedule. A "soft" overlap that the schedule then has to render somehow is worse UX than refusing the second booking. |
| 3 | Soft warning for outside-working-hours? | **Yes, non-blocking** | Roadmap §"Open questions" for Feature 7 explicitly asks "Booking outside availability with a warning?" — non-blocking matches the tourism-seasonal reality (late-night spa session for a hotel guest is normal). |
| 4 | Start-time granularity | **5-minute** | 1-minute is needless precision for a massage studio; 15-minute is too coarse for the 60-vs-90-minute service mix typical in Tulum. |
| 5 | Past-date entry window | **90 days** | Owners may want to log "I forgot to enter yesterday's"; 90 days catches typos like 2025 instead of 2026 while permitting realistic retro-entry. |
| 6 | Future-date entry window | **365 days** | Tourism advance bookings can be 6+ months out; 1 year is generous without permitting absurd typos. |
| 7 | `confirmed` only, or also `pending` from the start? | **`confirmed` only in v1** | Owner-entered bookings are by definition agreed-with-customer. `pending` is reserved for v2 customer self-booking. Keep the column but don't write `pending`. |
| 8 | Customer phone uniqueness scope | **Per-studio unique** | The same phone number across two studios should be allowed (a customer may exist in two studios). Within one studio, dedupe by phone. |
| 9 | Default currency | **Most recently used in this studio, fallback MXN** | Sticky-default reduces taps. Locale-default would surprise studios that book primarily USD even though the owner's UI locale is `es`. |
| 10 | Inline customer creation lives in the booking modal vs requires a pre-step | **Inline in the same modal** | The roadmap explicitly highlights "without scrolling WhatsApp" — context-switching to a separate "create customer" step before every new-tourist booking would re-create exactly that friction. |
| 11 | Owner-initiated cancel directly from the create form? | **No** | This spec is create-only. Cancel is Feature 8. |
| 12 | Booking notes vs customer notes — both? | **Both, distinct** | Service-specific note ("first time, communicate slowly") differs from a customer-level note ("prefers Spanish"). Confused fields would hurt the daily schedule's at-a-glance value. |

* * *

## 10. Research needed

The researcher should investigate before the architect designs the data model:

1. **Postgres `tstzrange` + `EXCLUDE USING GIST` vs explicit transactional pre-check for double-book prevention.** Recommend the simplest approach that (a) plays well with Supabase RLS, (b) supports the `WHERE status IN ('confirmed','pending')` predicate via partial exclusion, and (c) returns a clean error code distinguishable from generic CHECK violations so the API can translate it to `therapist_double_booked`. Confirm `btree_gist` extension status on Supabase (whether enabled by default or requires `CREATE EXTENSION`).
2. **Mexican phone validation library / regex** — confirm shared with the Feature 2 (studio profile) and Feature 3 (therapist roster) research, and reuse the same answer. Do not duplicate research.
3. **`Intl.DateTimeFormat` options for short-date + short-time** across `es-MX` and `en-US` with America/Cancun timezone forced. Confirm whether to render time as 12-hour (`9:30 AM`) or 24-hour (`09:30`) in each locale — recommend per Tulum cultural expectations. Cross-link with the Feature 5 daily-schedule spec (worker DJmain) — both features must format identically.
4. **`btree_gist` extension status on managed Supabase Postgres** — required for exclusion-constraint-based overlap prevention. If absent, the architect needs the transactional pre-check path; if present, the exclusion-constraint path is faster and race-safe by construction.
5. **DST in America/Cancun** — confirm Quintana Roo's permanent UTC-05 status (it left DST in 2015). One-paragraph reference for the architecture doc so the v2+ multi-timezone work doesn't silently inherit "America/Cancun never DSTs."
6. **Customer-name accent-insensitive substring matching in Postgres.** Likely `unaccent` extension + `ILIKE '%' || unaccent($1) || '%'`. Confirm extension availability on Supabase managed Postgres and recommend index strategy (functional index on `unaccent(name)`) for ≤200 customers per studio — at that scale a sequential scan is fine, but the architect should know the upgrade path.

* * *

## 11. Cross-references

- **ADR-0010** (service-price snapshot): the price-snapshot mechanism that this spec finally exercises. The booking row carries `currency` + `price_snapshot`; the column name in the migration may differ from `price_snapshot_mxn` because v1 supports two currencies — architect's call.
- **ADR-0011** (studio-scoped resource pattern): RLS template for `bookings` and `customers`.
- **Service Catalog spec / architecture** (CU-869d29f21): provides the source of `service.duration_minutes` (drives end-time) and `service.base_price_mxn` (default price for MXN bookings).
- **Therapist Roster spec / architecture** (CU-869d29f1p): provides the source of `therapist.status = 'active'` filter; deactivated therapists are not selectable.
- **Studio Profile spec / architecture** (CU-869d29f1h): provides studio operating hours (drives the soft warning §3.3 #2).
- **Feature 5 spec (DJmain, in flight):** consumer of these bookings on the daily schedule. Format / shape of the booking record returned by the list endpoint is a contract worth aligning on before BE-1 lands.
- **Feature 6 spec (P1, not started):** producer of therapist working-hours data (drives the soft warning §3.3 #1). This spec must NOT block on Feature 6 — it degrades gracefully.
- **Feature 8 spec (not started):** consumer of these bookings; reschedule/cancel paths. Worth specifying right after this one — share the data model.
- **Feature 9 spec (not started):** owns the customer-management screen; this spec creates the data Feature 9 will eventually render.
- **Feature 10 spec (not started):** consumes the `booking_created` event to send a confirmation email to the owner.

* * *

## 12. Suggested architecture / implementation breakdown (for the architect)

Not a decision — a sequencing hint to make the architect's job faster.

- **Migration 1:** `customers` table (`id`, `studio_id`, `name`, `phone`, `notes`, `created_at`, `updated_at`) with RLS per ADR-0011 and per-studio uniqueness on `phone`.
- **Migration 2:** `bookings` table (`id`, `studio_id`, `therapist_id`, `service_id`, `customer_id`, `start_time tstamptz`, `end_time tstamptz`, `currency text`, `price_snapshot integer`, `notes text`, `status text DEFAULT 'confirmed'`, timestamps). RLS per ADR-0011. Exclusion constraint per §10 #1.
- **NestJS module `bookings/`:** one POST endpoint `POST /studios/:studioId/bookings`. DTO + Zod validation. Translates Postgres exclusion violations to 409 `therapist_double_booked`. Emits server-side analytics (§6).
- **NestJS module `customers/`:** one POST endpoint for inline creation + one GET endpoint for combobox search. The inline-creation transactional path may live inside the bookings service to keep one round-trip.
- **Next.js:** new "New booking" modal triggered from the daily-schedule view (Feature 5). Form per §3.1. Mutation invalidates the schedule query for the booking's date (§3.7).
- **Designer:** booking modal + customer combobox + inline new-customer sub-form. Mobile layout matters (owner is sometimes phone-bound on the spa floor).
- **QA:** double-book race, currency switch behavior, retro-date 90-day edge, future-date 365 edge, warning-without-block, customer phone duplicate.
