# Spec — Booking Reschedule and Cancel

**Ticket:** [CU-869d29f2d](https://app.clickup.com/t/869d29f2d)
**Status:** Draft (awaiting Gate 1 approval)
**Author:** worker-04 (product-manager mode)
**Date:** 2026-05-17
**Roadmap reference:** v1 Roadmap §"Feature 8: Booking reschedule and cancel" (P0)

* * *

## 1. Problem

The v1 success definition says it plainly: "the studio owner can reschedule or cancel one [booking] in under 30 seconds — without scrolling WhatsApp, without guessing if a slot is free, without telling the affected therapist separately."

Feature 7 establishes the booking record. Feature 5 surfaces it on the daily schedule. **Feature 8 is the only mutation path against an existing booking in v1.** Without it, every change owners need to make today (the customer messages "can we move it to 4pm?" — happens multiple times per day in a tourism studio) requires deleting and recreating, which loses the price snapshot, the booking notes, the customer link, and the analytics trail.

This feature also closes the loop on cancellations. A cancelled booking is still data the owner may need (no-shows, refund disputes, "did they ever come back?"). Soft-cancel is the spec — never hard-delete a booking.

Primary user: the studio owner. Frequency: 2–6 reschedules/day, ~1–2 cancels/day, on average, for a 2-therapist Tulum studio. Both are the "second hottest" interaction path after viewing the schedule itself, and the 30-second benchmark is the literal product success metric.

* * *

## 2. User stories

1. As a studio owner, I want to tap a booking on the daily schedule and choose "Reschedule," so I can move it to a new time without re-entering customer or service info.
2. As a studio owner rescheduling a booking, I want to keep the same therapist OR pick a different active therapist, so I can absorb a sick day or load-balance across the team.
3. As a studio owner rescheduling a booking, I want the system to validate the new slot against the same rules as creation (no double-book; warning if outside hours), so I never accidentally promise the same therapist to two customers.
4. As a studio owner, I want the original booking's price snapshot, notes, currency, and customer to carry over to the rescheduled booking, so reschedule never loses historical or operational data.
5. As a studio owner, I want a "Cancel booking" action that requires one explicit confirm, so I never tap-through a cancel by mistake.
6. As a studio owner cancelling a booking, I want the booking to remain queryable (not hard-deleted) but disappear from the daily schedule, so the row is auditable later without polluting the view.
7. As a studio owner who just cancelled by mistake, I want to undo within a brief window (recommendation in §9 — confirm at Gate 1), so a stray tap doesn't force a recreate-from-scratch.

* * *

## 3. Acceptance criteria

### 3.1 Entry points

1. Given the daily schedule view (Feature 5) is rendered with at least one confirmed booking, when the owner taps a booking block, then a detail surface opens (modal, drawer, or popover — designer's call) showing read-only booking info and exactly two primary actions: **Reschedule** and **Cancel**. No other mutations are exposed here.
2. The detail surface displays: service name, therapist name, customer name + phone, start time, end time (computed), price (with currency), and notes (if any). All fields are read-only on this surface.
3. The detail surface is reachable only for `status = 'confirmed'` bookings. Cancelled bookings, if any are visible in v1, expose no actions (per F5 §3.4 #20 they are not rendered at all — but if a future feature surfaces them, the detail surface must respect this rule).
4. Direct-URL deep linking to the detail surface is **not** a v1 requirement. The detail surface lives inside the schedule page only.

### 3.2 Reschedule — form

5. The reschedule form pre-fills with the current booking's values and exposes these editable fields: **Therapist**, **Date**, **Start time**. All other fields (service, customer, currency, price, notes) are **read-only on this form** — see §4 for why and §3.7 for the workaround.
6. The therapist selector lists only `active` therapists in the studio (F3 status filter, identical to F7 §3.1).
7. The date selector accepts the same range as F7 §3.1 (90 days past to 365 days future).
8. The start time selector uses the same 5-minute granularity as F7 §3.1 #4. End time is recomputed: `end_time = new_start_time + service.duration_minutes`. The recomputed end time renders as a read-only preview ("Ends at HH:MM").
9. The submit button is labelled `bookings.reschedule.submit.label` ("Confirmar reprogramación" / "Confirm reschedule") and is disabled until at least one field has changed from the original. Submitting with no diff returns the form to itself with `bookings.reschedule.error.noChange` inline.
10. **Same-therapist-same-time submit** (no-op against the original row) is treated as "no change" and rejected client-side per #9. The API additionally short-circuits any UPDATE that produces zero column changes (idempotent guard).

### 3.3 Reschedule — server validation

11. The server validates the candidate range using **exactly the same exclusion-constraint mechanism** as F7 §3.2 (Postgres `EXCLUDE USING GIST` over `tstzrange` + `therapist_id`, filtered by `status IN ('confirmed','pending')`). See `docs/research/2026-05-17-bookings-domain.md` R1.
12. The booking being rescheduled does **not** conflict with itself: the exclusion constraint sees the UPDATE as a single row mutation; only OTHER rows' ranges are tested for overlap. (Per Postgres semantics — UPDATE replaces the row's range in a single transactional step, no self-conflict.)
13. On overlap with another active booking: API returns 409 `{ "error": "therapist_double_booked", "conflicting_booking_id": "..." }`. UI surfaces `bookings.reschedule.toast.error.doubleBooked` and keeps the form open with all entered values preserved (parallel to F7 §3.2 #2).
14. **Reschedule onto a cancelled slot is permitted.** A cancelled booking does not block the new range; the exclusion-constraint partial predicate already enforces this (R1 §"Cancelled bookings: never participate").
15. Soft warnings (outside therapist hours, outside studio hours) apply identically to F7 §3.3 — non-blocking, returned in `warnings: string[]`, surfaced as toasts using the same keys.
16. Service inactivation between detail-surface open and reschedule submit: API double-checks `services.status = 'active'`. On mismatch → 422 `{ "error": "service_inactive" }`. The reschedule is rejected (the owner should cancel + recreate with a different service).
17. Therapist inactivation between detail-surface open and reschedule submit (same pattern): 422 `{ "error": "therapist_inactive" }`. The reschedule is rejected.
18. Date out of bounds (90d past / 365d future): 422 `{ "error": "booking_too_far_in_past" }` or `"booking_too_far_in_future"` (same keys as F7).

### 3.4 Reschedule — data integrity

19. The reschedule path mutates the **same booking row** — it does NOT create a new row and soft-delete the old one. Booking `id` is preserved; the `created_at` is preserved; only `therapist_id`, `start_time`, `end_time`, `updated_at` change.
20. `price_snapshot` is **never** modified by reschedule. If the service's `base_price_mxn` has changed between booking creation and reschedule, the original snapshot stands (ADR-0010 invariant). This holds even if the reschedule moves the booking to a new service category that has a different base price — the price is owner-set at create time, the snapshot reflects what was agreed, and reschedule does not renegotiate it.
21. `currency` is **never** modified by reschedule (F7 §3.5 #7 — "Editing currency on an existing booking is out of scope for v1"). The currency control on the reschedule form is omitted entirely; it is not even read-only — it is absent.
22. `customer_id` is **never** modified by reschedule. A wrong-customer booking is cancel-and-recreate. (Reason: reattaching a customer mid-booking is a CRM concern that v1 doesn't surface — Feature 9 is P1 and standalone.)
23. `notes` is **not** editable in the reschedule form in v1. (See §4 — the v1 reschedule scope is strictly "move it in time and/or to a different therapist." Adding note-editing in a separate "edit details" path is a clean follow-up that does not need this spec.)
24. `service_id` is **not** editable in the reschedule form. (Same reason as #23. A different service often means a different duration and price, which changes the meaning of the booking enough that cancel + recreate is the right path.)

### 3.5 Reschedule — analytics

25. A successful reschedule emits `booking_rescheduled` (see §6). Properties capture old vs new therapist, old vs new start time, and the duration delta (`new_start_time - old_start_time` in minutes; can be negative).
26. A blocked reschedule emits `booking_reschedule_blocked` with `reason` populated from the same enum as F7's create-blocked event plus `'no_change'` for the §3.2 #9 case.

### 3.6 Cancel — flow

27. The detail surface (§3.1) exposes a "Cancel" button labelled `bookings.cancel.button.label` ("Cancelar reserva" / "Cancel booking"). The button is visually destructive (designer's call on exact treatment — at minimum, semantically distinct from the Reschedule action).
28. Tapping Cancel opens a confirmation dialog with title `bookings.cancel.confirm.title`, body `bookings.cancel.confirm.body` (showing customer name + start time so the owner knows what they're cancelling), and two buttons: **Cancelar reserva** (destructive) and **Volver** (back to detail surface).
29. The confirmation dialog is the **only** confirmation step. There is no second-confirm, no "type the customer name to confirm." The 30-second benchmark mandates a single decisive step. The undo path (§3.8) backstops mistakes.
30. On confirm: API marks `status = 'cancelled'`, sets `cancelled_at` to `now()`, returns the updated row. UI closes the detail surface, removes the block from the schedule, and shows a success toast `bookings.cancel.toast.success` (the toast contains the undo CTA — see §3.8).
31. On dismiss: no API call, surface stays where it was.

### 3.7 Cancel — server semantics

32. Cancel is a soft state transition: `status = 'cancelled'`. The row is never DELETEd by the cancel path. No DELETE endpoint exists for `bookings` in v1.
33. Cancelling an already-cancelled booking → 409 `{ "error": "booking_already_cancelled" }`. The UI should not expose the cancel action on cancelled bookings (per §3.1 #3), so this 409 is a guard against direct-API misuse.
34. Cancelling a booking in any future status (e.g. `pending`, reserved for v2) is **not in scope** for this spec. The status enum permits the value; the v1 cancel path operates on `confirmed` only.
35. Cancel is idempotent in spirit but not in fact: the second request returns 409 (#33), not 200. The UI never issues a duplicate cancel because the detail surface is removed on success (#30).
36. Cancel emits `booking_cancelled` (see §6).
37. **Cancellation does NOT cascade.** Customer rows are unaffected; the customer remains queryable for future bookings. Service rows are unaffected.

### 3.8 Cancel — undo window

38. The success toast in §3.6 #30 includes an inline "Deshacer" / "Undo" affordance.
39. **The undo window is the lifetime of the toast** (recommended Gate 1 default: 8 seconds, per the i18n notification convention used elsewhere in the app — see §9 OQ-3). Once the toast dismisses, the cancel is final.
40. Activating Undo issues an UPDATE that flips `status` back to `confirmed`, clears `cancelled_at`, and re-renders the block on the schedule.
41. **Undo must re-validate the slot.** Between the cancel and the undo, the freed slot may have been filled by a different new booking (rare but possible if the owner is fast). The undo runs the same exclusion-constraint check; on conflict it returns 409 `{ "error": "therapist_double_booked", "conflicting_booking_id": "..." }` and the UI surfaces `bookings.cancel.undo.error.slotTaken` — the booking remains cancelled.
42. Undo emits `booking_cancel_undone` (see §6).

### 3.9 Authorization

43. All bookings endpoints require an authenticated session for an owner whose `studio_id` matches `bookings.studio_id`. Enforced at Supabase RLS via the ADR-0011 pattern (parallel to F7 §3.8).
44. RLS UPDATE policy on `bookings` MUST include both `USING` and `WITH CHECK` predicates — the WITH CHECK is what prevents an owner from rewriting `studio_id` and stealing another studio's booking (parallel to the existing services policy at `architecture/CU-869d29f21-service-catalog.md` line 102).
45. Reschedule and Cancel endpoints return 404 (not 403) for a `booking_id` that doesn't exist OR doesn't belong to the owner's studio. This is the same opacity that all other studio-scoped resources use — never reveal cross-studio existence.

### 3.10 Concurrency

46. If two owners (or one owner across two tabs) attempt to reschedule the same booking simultaneously, **last write wins**. Both UPDATEs succeed; the second overwrites the first. No optimistic-lock token (`updated_at` check) in v1 — same call as the Therapist Roster spec's §5 ("v1 has one owner per studio, so concurrent edits unlikely").
47. If one owner reschedules booking-A and another owner (or tab) reschedules booking-B into the same target slot simultaneously, exactly one UPDATE succeeds (constraint enforces). The loser sees a 409 (parallel to F7 §3.2 #2).
48. If one owner cancels booking-X while another owner reschedules booking-Y onto X's freed slot in the same window: the reschedule's exclusion check runs against the live state after the cancel commits. Standard Postgres MVCC handles this — no special locking required.

### 3.11 Schedule integration

49. After a successful reschedule, undo, or cancel, the FE invalidates the daily-schedule query for **both** the old date and the new date (in the reschedule-across-days case). The schedule re-renders within ≤2 seconds. (Parallel to F7 §3.7.)
50. Reschedule across two different days: if the owner is currently viewing date A and reschedules a booking to date B, the schedule stays on date A (the booking disappears from the view) and the success toast carries a "Go to {dateB}" affordance. (Designer to refine; minimum behavior is "schedule does not auto-jump.")

* * *

## 4. Out of scope

- **Editing a booking's `service`, `customer`, `notes`, `price`, or `currency` after creation.** v1 path is cancel + recreate. (§3.4 #20–24 enumerate.)
- **Hard delete of a booking.** Soft-cancel only. No DELETE endpoint on `bookings`.
- **Bulk reschedule / bulk cancel.** Each row is operated on individually in v1.
- **Notifying the customer** of a reschedule or cancel. Customer has no portal, no email, no SMS, no WhatsApp send in v1. (Feature 11 is P2 and outbound-only.)
- **Notifying the therapist** of a reschedule or cancel. Feature 11 (P2) covers WhatsApp; until it ships, the owner tells the therapist manually.
- **Refunds / payment voids.** No payments in v1 (Stripe is v2+).
- **Recurring / standing booking reschedule.** Each booking is discrete.
- **Booking history / audit log surface.** The `updated_at` column captures last-mutation time. A v2+ "booking history" UI is a separate feature; v1 does not surface a per-booking change log.
- **Reschedule a `cancelled` booking back to `confirmed` at a new time.** The path is undo (§3.8) within the toast window only. After the toast dismisses, the booking is final-cancelled and the owner creates a new booking (F7).
- **`pending` status transitions.** Reserved for v2 customer self-booking.
- **Multi-step "Are you sure?" cancel confirmation.** §3.6 #29 is explicit — single confirm only. The 30-second benchmark forbids friction here.
- **Persistent (database-stored) undo.** The undo window is the lifetime of one toast in one session. Closing the browser ends the undo opportunity. Persisted undo is a v2+ concern.
- **Booking transfer between studios.** A v1 booking is owned by exactly one studio, immutable.

* * *

## 5. Edge cases and error states

- **Detail surface opened on a booking that was cancelled in a different tab.** On reschedule or cancel submit → 409 (`booking_already_cancelled` for cancel) or 404 (`booking_not_found`) — UI surfaces the appropriate toast and closes the surface, schedule re-fetches.
- **Reschedule onto the owner's own booking.** The form's "no diff" guard (§3.2 #9) catches this in the simple case. If the owner has two bookings and tries to reschedule booking-A into booking-B's slot (different rows, same `therapist_id`, overlapping range), the exclusion constraint fires → 409 `therapist_double_booked` with `conflicting_booking_id` set to booking-B's id.
- **Reschedule into the past — but within the 90-day window.** Permitted (retro-correct entries). The non-blocking warning for "outside studio hours" still applies if the new slot is on a closed day.
- **Reschedule crossing the booking's own end time** (e.g. service is 60 minutes, current range [10:00, 11:00); reschedule to 10:30 same therapist). The owner is moving the booking to overlap itself. The UPDATE replaces the row's range in one statement; the exclusion check sees the new range and the OTHER bookings only — the row is NOT compared to its own pre-update range. Postgres semantics make this a no-op self-conflict. Accepted as v1 behavior.
- **Network failure on reschedule submit.** Form retains all entered values; `toast.error.network`; no optimistic update.
- **Network failure on cancel submit.** Confirmation dialog stays open with `toast.error.network`; user can retry. No partial state.
- **Network failure on undo.** Toast keeps the undo affordance until the toast naturally dismisses; if undo fails repeatedly, the toast surfaces `bookings.cancel.undo.error.network` and the booking remains cancelled. (Design choice: don't trap the owner — fail closed.)
- **Reschedule into the same slot the booking just vacated.** If the form changes therapist to therapist-X and back to original-Y without other changes, the "no diff" guard (§3.2 #9) catches it after the second toggle.
- **`prefers-reduced-motion` users.** Cancel toast and detail-surface transitions must respect `prefers-reduced-motion` per the accessibility baseline. (Designer responsibility.)
- **Concurrent cancel and reschedule of the same booking from two tabs.** First request commits, second request returns 409 (`booking_already_cancelled`) or 404. The schedule on the second tab refreshes on its next interaction.
- **DST / Cancun.** No DST. (R5 in the research report.)

* * *

## 6. Analytics and success metrics

All server-side, except the `_form_opened` events.

| Event | Properties | When fired |
| --- | --- | --- |
| `booking_detail_opened` | `studio_id`, `booking_id` | When the detail surface in §3.1 opens (client-emitted) |
| `booking_reschedule_form_opened` | `studio_id`, `booking_id` | When the reschedule form opens (client-emitted) |
| `booking_rescheduled` | `studio_id`, `booking_id`, `old_therapist_id`, `new_therapist_id`, `old_start_time`, `new_start_time`, `time_delta_minutes`, `therapist_changed: bool`, `date_changed: bool`, `warnings: string[]` | Successful UPDATE commit (server) |
| `booking_reschedule_blocked` | `studio_id`, `booking_id`, `reason: 'therapist_double_booked' \| 'service_inactive' \| 'therapist_inactive' \| 'booking_too_far_in_past' \| 'booking_too_far_in_future' \| 'invalid_start_time_granularity' \| 'no_change' \| 'booking_not_found'` | On API 409 / 422 |
| `booking_cancelled` | `studio_id`, `booking_id`, `confirmed_lifetime_hours: number` (booking creation → cancel, in hours), `lead_time_hours: number` (cancel → original start time, negative if cancelled after the slot passed), `from_status: 'confirmed'` | After commit |
| `booking_cancel_undone` | `studio_id`, `booking_id`, `time_in_cancelled_state_seconds: int` | After the undo UPDATE commits |
| `booking_undo_failed` | `studio_id`, `booking_id`, `reason: 'slot_taken' \| 'network' \| 'booking_too_old'` | If the undo cannot be applied (rare) |

Never log customer names, phones, or notes — ids only.

**Success metrics**

- **Primary (binds to the v1 90-day metric):** the median `booking_rescheduled` and `booking_cancelled` "time-in-modal" (client-measured from `booking_detail_opened` to commit) is **< 30 seconds**, sustained across the first 30 days of real usage. This is the literal product metric.
- **Secondary:** `booking_reschedule_blocked.reason = 'no_change'` rate < 5% of `booking_rescheduled` events (high rate means the form is exposing too many editable fields or the owner is using the form to view rather than mutate — UX signal).
- **Cancel-undo telemetry:** `booking_cancel_undone / booking_cancelled` ratio. v1 baseline tracking only — if >15% sustained, the cancel confirmation in §3.6 #28 is not clear enough.
- **Health check:** zero `booking_already_cancelled` 409s traceable to UI (confirms the detail surface never exposes cancel on cancelled bookings).

* * *

## 7. Roles and permissions

- **Studio owner only.** Full reschedule + cancel + undo on bookings in their studio.
- **Therapist:** no login, no access in v1.
- **Customer:** no access in v1.

**RLS — bookings (full set, UPDATE + DELETE policy):**

```sql
-- SELECT (already covered by F7 spec; included here for completeness)
USING (
  studio_id IN (
    SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
  )
)

-- UPDATE (this spec — both USING and WITH CHECK required)
USING (
  studio_id IN (
    SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  studio_id IN (
    SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
  )
)

-- DELETE: no policy. DELETE is never authorized on bookings in v1.
```

The UPDATE policy applies to both reschedule (mutates `therapist_id`, `start_time`, `end_time`) and cancel + undo (mutates `status`, `cancelled_at`). The exclusion constraint handles overlap orthogonally.

* * *

## 8. Localization

All keys under `bookings.detail.*`, `bookings.reschedule.*`, `bookings.cancel.*`. `es` canonical.

```python
bookings.detail.title                          es: "Detalles de la reserva"                              en: "Booking details"
bookings.detail.field.service                  es: "Servicio"                                            en: "Service"
bookings.detail.field.therapist                es: "Terapeuta"                                           en: "Therapist"
bookings.detail.field.customer                 es: "Cliente"                                             en: "Customer"
bookings.detail.field.time                     es: "Horario"                                             en: "Time"
bookings.detail.field.price                    es: "Precio"                                              en: "Price"
bookings.detail.field.notes                    es: "Notas"                                               en: "Notes"
bookings.detail.action.reschedule              es: "Reprogramar"                                         en: "Reschedule"
bookings.detail.action.cancel                  es: "Cancelar reserva"                                    en: "Cancel booking"

bookings.reschedule.title                      es: "Reprogramar reserva"                                 en: "Reschedule booking"
bookings.reschedule.therapist.label            es: "Terapeuta"                                           en: "Therapist"
bookings.reschedule.date.label                 es: "Nueva fecha"                                         en: "New date"
bookings.reschedule.startTime.label            es: "Nueva hora"                                          en: "New start time"
bookings.reschedule.endTime.preview            es: "Termina a las {endTime}"                             en: "Ends at {endTime}"
bookings.reschedule.submit.label               es: "Confirmar reprogramación"                            en: "Confirm reschedule"
bookings.reschedule.error.noChange             es: "No hay cambios para guardar."                        en: "No changes to save."
bookings.reschedule.toast.success              es: "Reserva reprogramada"                                en: "Booking rescheduled"
bookings.reschedule.toast.error.doubleBooked   es: "Este terapeuta ya tiene una reserva en esa hora."    en: "This therapist already has a booking at that time."
bookings.reschedule.toast.error.serviceInactive es: "El servicio fue desactivado."                       en: "The service was deactivated."
bookings.reschedule.toast.error.therapistInactive es: "El terapeuta fue desactivado."                    en: "The therapist was deactivated."
bookings.reschedule.toast.error.tooFarInPast   es: "La fecha es de hace más de 90 días."                 en: "Date is more than 90 days in the past."
bookings.reschedule.toast.error.tooFarInFuture es: "La fecha es a más de 365 días en el futuro."         en: "Date is more than 365 days in the future."
bookings.reschedule.toast.warning.outsideTherapistHours es: "Reprogramado fuera del horario habitual del terapeuta." en: "Rescheduled outside the therapist's usual hours."
bookings.reschedule.toast.warning.outsideStudioHours    es: "Reprogramado fuera del horario del estudio." en: "Rescheduled outside the studio's operating hours."
bookings.reschedule.toast.success.crossDay     es: "Reprogramado al {newDate}"                           en: "Rescheduled to {newDate}"
bookings.reschedule.toast.success.crossDay.cta es: "Ver {newDate}"                                       en: "View {newDate}"

bookings.cancel.button.label                   es: "Cancelar reserva"                                    en: "Cancel booking"
bookings.cancel.confirm.title                  es: "¿Cancelar esta reserva?"                             en: "Cancel this booking?"
bookings.cancel.confirm.body                   es: "{customerName} a las {startTime}. Esta acción se puede deshacer durante unos segundos." en: "{customerName} at {startTime}. You can undo this for a few seconds."
bookings.cancel.confirm.action                 es: "Sí, cancelar"                                        en: "Yes, cancel"
bookings.cancel.confirm.back                   es: "Volver"                                              en: "Back"
bookings.cancel.toast.success                  es: "Reserva cancelada"                                   en: "Booking cancelled"
bookings.cancel.toast.success.undoCta          es: "Deshacer"                                            en: "Undo"
bookings.cancel.undo.toast.success             es: "Cancelación deshecha"                                en: "Cancellation undone"
bookings.cancel.undo.error.slotTaken           es: "No se pudo deshacer: la hora ya está ocupada."       en: "Couldn't undo: that slot is now booked."
bookings.cancel.undo.error.network             es: "No se pudo deshacer. Intenta crear la reserva de nuevo." en: "Couldn't undo. Try creating the booking again."
```

Reuse the F7 namespace for shared inputs (`bookings.form.therapist.*`, `bookings.form.startTime.*`, etc.) where the reschedule form mirrors the create form. The keys above are reschedule/cancel-specific only.

Date and time formatters: shared helper module (see `docs/research/2026-05-17-bookings-domain.md` R3). 12-hour clock in both locales, `America/Cancun` forced. F5, F7, and F8 share the helper.

* * *

## 9. Open questions for human review (Gate 1)

| # | Question | Recommendation | Rationale |
| --- | --- | --- | --- |
| 1 | Reschedule scope — therapist + date + time only, or also service/notes/customer? | **Therapist + date + time only** | The 30-second benchmark and the §4 boundary. Edit-everything bloats the form and the spec; cancel + recreate is the v1 path for cross-cutting changes. |
| 2 | Reschedule preserves price snapshot? | **Yes — never recomputed** | ADR-0010's invariant. Even if the service price changed since creation, the snapshot is what was agreed. |
| 3 | Undo window length | **8 seconds (toast lifetime)** | Long enough to catch a mis-tap, short enough that the schedule isn't haunted by ghost bookings. Standard pattern in calendar apps. |
| 4 | Undo across browser sessions? | **No — session-scoped only** | Persistent undo is a v2 audit-log concern. v1 finality after toast dismisses is acceptable for a single-owner workflow. |
| 5 | Cancel requires a second "type-to-confirm" step? | **No, single confirm only** | The 30-second benchmark forbids friction. Undo backstops mistakes. |
| 6 | Cancellation reason captured? | **No** | A free-text "why" field doubles the cancel flow's tap count without operational use in v1. Add in v2 if the §6 cancel-undone ratio signals it's needed. |
| 7 | Reschedule across studios? | **No** | A booking belongs to one studio. Multi-studio ownership is v2+ per roadmap. |
| 8 | Surface cancelled bookings anywhere in v1? | **No** | F5 §3.4 #20 hides them. F12 (upcoming list, P1) is also confirmed-only per its spec. v1 has no "history" surface. |
| 9 | Allow rescheduling a booking to a different `service_id` if the duration is identical? | **No** | Service is part of the booking's identity (price snapshot, billing intent). A "same-duration swap" looks innocent but introduces precedent for cross-cutting edits. Cancel + recreate. |
| 10 | Should the detail surface (§3.1) expose a "Copy customer phone" or "Send WhatsApp" action? | **Not in v1** | F11 (WhatsApp notifications) is P2. A "tel: / whatsapp://" link is tempting but introduces a privacy / native-handler surface area that's better designed once with F11. |

* * *

## 10. Research needed

All booking-domain research is **already complete** in `docs/research/2026-05-17-bookings-domain.md` (the research report that landed alongside this spec). The architect can author the bookings ADR directly from that document. No additional research items are introduced by F8.

The only F8-specific note for the architect:

- The UPDATE policy on `bookings` must include `WITH CHECK`, not just `USING`, for the same reason the services policy does (prevents `studio_id` cross-write). See `docs/architecture/CU-869d29f21-service-catalog.md` line 102 for the prior pattern.

* * *

## 11. Cross-references

- **F7 spec (CU-869d29f2c)** — provides the booking record and the create path. F8 mutates that record.
- **F5 spec (feature-5-daily-schedule-view.md)** — provides the entry point (tap on a booking block opens F8's detail surface). The §3.1 tap behavior must align with F5's "tap area is reserved" comment in F5 §3.4 #17.
- **Research report (`docs/research/2026-05-17-bookings-domain.md`)** — R1 (exclusion constraint) and R4 (storage shape) are the load-bearing inputs for F8's reschedule path.
- **ADR-0010** — price snapshot invariant; F8 honors it explicitly in §3.4 #20.
- **ADR-0011** — studio-scoped RLS pattern; UPDATE policy in §7 follows it.
- **F6 spec (not yet written)** — therapist availability; F8 reschedule's outside-therapist-hours warning becomes operative once F6 ships.
- **F11 spec (P2, not yet written)** — therapist WhatsApp notification. F8 will emit `booking_rescheduled` and `booking_cancelled` events that F11 may eventually consume.

* * *

## 12. Suggested architecture / implementation breakdown (for the architect)

Not a decision — a sequencing hint.

- **Migration:** add `cancelled_at timestamptz NULL` column to `bookings` (the F7 migration may already include this; if not, F8 adds it). No new index on `cancelled_at` in v1 — the only query that filters on it is the optional v2 audit surface.
- **NestJS module `bookings/`:**
  - `PATCH /studios/:studioId/bookings/:bookingId/reschedule` — body `{ therapistId, date, startTime }`. Translates Postgres `23P01` to 409 `therapist_double_booked`.
  - `POST /studios/:studioId/bookings/:bookingId/cancel` — body empty. Sets `status = 'cancelled'`, `cancelled_at = now()`. Returns the updated row.
  - `POST /studios/:studioId/bookings/:bookingId/undo-cancel` — body empty. Sets `status = 'confirmed'`, `cancelled_at = NULL`. Re-runs the exclusion check (the constraint does this automatically; just catch `23P01` and translate).
- **Next.js:** booking-detail surface triggered from F5 schedule. Reschedule form is a variant of the F7 create form (share the same `<TherapistPicker>`, `<DatePicker>`, `<StartTimePicker>` components — designer's call on exact composition). Cancel is a single confirm dialog + post-success toast with inline undo CTA.
- **Designer:** detail surface (modal / drawer), reschedule form (90% reused from F7 create form), cancel confirmation dialog, success toast with undo affordance, cross-day reschedule success toast. Mobile layout: same as F5 (375px minimum).
- **QA:** reschedule overlap with another active booking; reschedule onto a cancelled slot; cancel + immediate undo; cancel + slow undo (slot filled by F7 create from another tab); reschedule across days; no-change submit; cancelled-booking 409 guard on direct API.
