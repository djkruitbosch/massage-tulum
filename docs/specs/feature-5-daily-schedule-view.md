# Spec — Feature 5: Daily Schedule View (The Spine)

**Ticket:** Feature 5 (v1 Roadmap)
**Status:** Draft — awaiting Gate 1 approval
**Author:** product-manager (agent)
**Date:** 2026-05-16
**Roadmap reference:** v1 Roadmap (2026-04-26), Feature 5, P0 — "THE SPINE"

---

## Summary

The studio owner opens the app at the start of their workday and sees — in a single glance — every booking across all active therapists for that day. The view is a vertical time rail with one column per therapist. Each booking appears as a labelled time block showing the service name, customer name, and time. The owner can navigate to yesterday and tomorrow with a single tap, jump to any date with a date picker, and see a "current time" line on the rail indicating where they are in the day. Empty time is visible as open space (or a "+" placeholder that will become the F7 entry point). This view IS the v1 value proposition — it replaces the owner's morning WhatsApp scroll.

---

## 1. Problem

A Tulum massage studio owner currently starts their day by scrolling through WhatsApp groups and a mental model of who is working today. There is no authoritative, at-a-glance answer to "what does today look like across my team?" The owner wastes 5–10 minutes every morning piecing this together, and errors happen: double-bookings, therapists showing up for cancelled sessions, customers arriving for rescheduled appointments without anyone knowing.

**Who has this problem:** The studio owner (single user in v1). This is the primary person this product exists for. Frequency: daily, every working day.

**The 30-second benchmark (context only — not F5 scope):** The v1 roadmap defines success as the owner being able to reschedule or cancel a booking in under 30 seconds. That action lives in F8 (Reschedule/Cancel). F5 is the view that surfaces the booking to be acted on — without F5, the owner cannot identify, locate, or reach that booking in the first place.

---

## 2. User stories

1. As a studio owner, I want to see all of today's bookings at a glance across all my therapists, so I know what my day looks like without scrolling through WhatsApp history.
2. As a studio owner, I want to navigate forward and backward by day (yesterday, today, tomorrow), so I can quickly check what is ahead or review what happened yesterday.
3. As a studio owner, I want to jump to a specific date with a date picker, so I can check any day without tapping forward one at a time.
4. As a studio owner, I want to see a "current time" indicator on the schedule rail, so I always know which appointments are past, currently in progress, or upcoming.
5. As a studio owner, I want to see available (empty) time slots clearly, so I can immediately see where there is space for a new booking without mental arithmetic.
6. As a studio owner, I want to see each therapist's column even when they have no bookings today, so I know the absence is intentional and not a display error.
7. As a studio owner, I want deactivated therapists to not appear on the schedule, so the view reflects only my active team.

---

## 3. Acceptance criteria

Numbers within each section are sequential and unique across the entire spec for unambiguous QA reference. Given/when/then format throughout.

### 3.1 Page load and routing

1. Given an authenticated studio owner, when they navigate to `/studio/schedule`, then the daily schedule page renders and defaults to today's date in the `America/Cancun` timezone.
2. Given an unauthenticated request to `/studio/schedule`, when the middleware evaluates the session, then the request is redirected to the login page and no booking data is returned.
3. Given an authenticated owner whose studio has no active therapists, when the schedule page loads, then the page renders the `schedule.emptyState.noTherapists.*` empty state with a CTA linking to `/studio/therapists`.
4. Given an authenticated owner whose studio has no active services in the catalog, when the schedule page loads, then the page renders normally — zero services does not block the schedule view (services are required per booking, not per view).
5. Given a valid `?date=YYYY-MM-DD` query parameter in the URL, when the schedule page loads, then it renders that specific date's bookings rather than today's.
6. Given an invalid or malformed `?date` parameter, when the page loads, then it falls back to today's date and ignores the invalid parameter silently (no error shown to the owner).

### 3.2 Column-per-therapist layout

7. Given one or more active therapists in the studio, when the schedule renders, then exactly one column renders per active therapist, and the column header displays that therapist's name.
8. Given the therapist list includes both active and deactivated therapists, when the schedule renders, then only active therapists (status = `active`) have columns — deactivated therapists produce no column. _Cross-ref: F3 (Therapist Roster) surfaces a deactivation warning when a therapist with future bookings is deactivated. That warning is the primary safeguard against the "orphaned booking" edge case described in §6._
9. Given a studio with between 1 and 5 active therapists (the primary design target), when the schedule renders, then all therapist columns are visible without layout breakage.
10. Given a studio with 5 or more active therapists, when the schedule renders, then all columns are accessible (horizontal scroll within the schedule grid is acceptable); no booking data is hidden; no column is clipped invisibly.
11. Given a therapist is deactivated after the schedule page has loaded, when the owner views the same session without refreshing, then the deactivated therapist's column remains visible until the page is reloaded (stale view is acceptable in v1 — no real-time column removal required).

### 3.3 Time rail

12. Given the studio has operating hours configured for the viewed day (from F2 Studio Profile), when the schedule renders, then the vertical time rail spans from the studio's opening time to closing time for that day, and no time outside those bounds is displayed.
13. Given the time rail is rendering, when tick marks are displayed, then they appear at a fixed interval of 30 minutes (default per OQ-4 resolution — see §10). Each tick mark is labelled with the time in 12-hour format matching the convention in the Studio Profile spec (e.g., "9:00 AM", "1:30 PM").
14. Given all time labels on the rail, when rendered in either locale, then they represent the local time in `America/Cancun` (UTC-5, no DST). No timezone conversion is performed in the UI layer.

### 3.4 Booking blocks

15. Given a confirmed booking assigned to therapist T starting at time S with duration D minutes, when the schedule renders, then a booking block appears in therapist T's column, positioned at time S on the rail, with a height proportional to D minutes.
16. Given a booking block, when rendered at any size, then it displays at minimum: the service name and the customer name (or `schedule.booking.unknownCustomer.*` if no customer is linked).
17. Given a booking block whose duration is too short for all text to fit, when rendered, then text is truncated with ellipsis rather than overflowing the block or being hidden entirely. The full details must be accessible on tap (F8 wires this action; F5 reserves the tap area and passes the booking ID on tap).
18. Given two confirmed bookings in different therapist columns that overlap in time, when the schedule renders, then both blocks are visible in their respective columns with no data loss.
19. Given two confirmed bookings in the same therapist column that overlap in time (a data conflict created despite F7's validation), when the schedule renders, then both blocks are visible (side-by-side within the column or with a visual overlap indicator — exact treatment deferred to designer). F5 does not hide or silently drop either booking.
20. Given the resolved decision for OQ-3 (cancelled bookings are hidden), when the schedule renders, then bookings with status `cancelled` (or the equivalent cancelled status in the architect's schema) do not appear as blocks.

### 3.5 Day navigation

21. Given the schedule is displaying any date, when the page renders, then the header displays the viewed date in the format resolved per the designer's date format decision, in the active locale (e.g., "Lunes 16 de mayo" for `es`, "Monday, May 16" for `en`).
22. Given the owner activates the "previous day" control, when the navigation completes, then the URL updates to `?date=<previous-date>`, booking data for the previous day is fetched, and the schedule re-renders without a full page reload.
23. Given the owner activates the "next day" control, when the navigation completes, then the URL updates to `?date=<next-date>`, booking data for the next day is fetched, and the schedule re-renders without a full page reload.
24. Given the viewed date is not today, when the owner activates the "Today" control, then the URL updates to today's date (or removes the `?date` parameter), booking data for today is fetched, and the schedule re-renders.
25. Given the viewed date is already today, when the schedule renders, then the "Today" control is visually inactive or hidden (exact treatment deferred to designer — the spec requires it not be a dead click that navigates to the same date unnecessarily).
26. Given the owner activates the date picker and selects a date, when the date picker closes, then the URL updates to `?date=<selected-date>`, booking data is fetched, and the schedule re-renders.
27. Given any day navigation action, when the action completes successfully, then the `schedule_day_navigated` analytics event fires (see §7).
28. Given any day navigation action, when the booking data fetch fails (network or server error), then the current date's schedule remains visible, a toast error (`schedule.toast.navError.*`) is shown, and no URL change is committed. The owner can retry.

### 3.6 Current time indicator

29. Given the viewed date is today, when the schedule renders, then a horizontal "now" line appears across all therapist columns at the position corresponding to the current local time in `America/Cancun`.
30. Given the "now" line is visible, when one minute elapses, then the "now" line automatically repositions to reflect the updated current time. No user interaction or page reload is required.
31. Given the viewed date is not today, when the schedule renders, then no "now" line is shown.
32. Given the current local time falls outside the studio's operating hours (before opening or after closing), when the schedule renders, then the "now" line is not displayed (the off-hours period is not part of the rendered rail).
33. Given the "now" line is rendered, when a screen reader encounters it, then it reads an accessible label (`schedule.nowIndicator.label.*` — "Ahora" / "Now") rather than the raw visual element.

### 3.7 Mobile and responsive behavior

34. Given a viewport width of 1024px or wider, when the schedule renders, then the full column-per-therapist grid renders within the `container.wide` (1280px max-width) container per `docs/design/responsive.md`.
35. Given a viewport width of 375px (minimum supported, per `docs/design/responsive.md` §2), when the page renders, then the page body (excluding the schedule grid container) has no horizontal scroll — verified by `document.documentElement.scrollWidth === 375`.
36. Given a viewport width of 375px, when the schedule grid is wider than the viewport, then the schedule grid container scrolls horizontally within its own bounds, and the page body does not scroll horizontally.
37. Given any viewport width below 640px, when the schedule renders, then all interactive navigation controls (prev day, next day, today, date picker trigger) are reachable without horizontal scroll on the page chrome and each has a minimum tappable area of 44×44px per `docs/design/accessibility.md` §6.

### 3.8 Empty states

38. Given a day with no bookings for any therapist and the empty slot rendering resolved as "+" placeholder (OQ-1 default), when the schedule renders, then each 30-minute slot in each therapist column shows the `schedule.slotPlaceholder.addBooking.*` placeholder. The placeholder is visual only in F5 — it has no click handler yet (F7 adds the handler).
39. Given a specific therapist column with no bookings while other therapist columns have bookings, when the schedule renders, then the empty column renders with the same slot placeholder treatment as in criterion 38, and the column does not collapse or disappear.
40. Given the studio profile marks the viewed day as closed (e.g., Sunday marked `closed`), when the schedule renders, then the time rail is not rendered; instead, the `schedule.closedDay.*` state is shown with a message and the day navigation controls remain available.
41. Given the studio has no operating hours configured at all (null hours), when the schedule renders, then the page uses a fallback rail (8:00 AM – 8:00 PM) and shows a warning banner `schedule.warning.hoursNotSet.*` with a CTA to `/studio/profile`.

### 3.9 Data freshness and loading

42. Given the schedule page loads for the first time, when data is being fetched, then a loading state is shown (exact visual deferred to designer — at minimum the page must not show blank white with no indication of activity).
43. Given the schedule page has loaded successfully, when the owner leaves the page open without interacting, then booking data is NOT automatically refreshed (no polling, no WebSocket subscription for booking data in v1). Stale booking data is acceptable; the owner reloads or re-navigates to refresh.
44. Given a booking data fetch fails on page load, when the fetch returns a network or server error, then the schedule shows the `schedule.error.fetchFailed.*` error state with a retry button. The page does not show booking data from a previously viewed date.
45. Given the retry button in the error state, when the owner activates it, then the booking data fetch is retried for the same date.

### 3.10 Authorization and data scoping

46. Given an authenticated owner, when booking data is fetched for any date, then the response contains only bookings belonging to that owner's studio (enforced by RLS — the API must not return cross-studio data under any circumstances). A cross-studio data leak is a critical security defect with no acceptable workaround.
47. Given a direct API call to the bookings endpoint without a valid session token, when the API processes the request, then it returns HTTP 401 and no booking data.

---

## 4. Out of scope (F5 boundary)

The following are explicitly NOT part of F5. Any implementation that bleeds into these areas must be re-scoped before merge.

- **Booking creation (F7):** The "+" slot placeholder may be rendered in F5 as a static visual affordance, but the booking creation form, conflict validation, and write path to the bookings table belong entirely to F7. F5 ships with no write operations.
- **Booking reschedule and cancel (F8):** Tapping a booking block is a tap interaction area that F5 reserves (passing booking ID on tap), but the reschedule/cancel UI, form, and mutations belong to F8. F5 ships with no reschedule or cancel actions.
- **Therapist availability shading (F6):** F5 shows bookings only. Available slot shading derived from per-therapist working hours (F6 availability configuration) is not rendered in F5. Operating-hour endpoints from F2 define only the rail bounds — not per-therapist availability within those bounds.
- **Customer profile linking (F9):** F5 displays the customer name stored on the booking record. It does not link to a customer profile page or provide CRM lookup.
- **Owner booking confirmation email (F10):** No email sending in F5.
- **Therapist WhatsApp notifications (F11):** No messaging in F5.
- **Multi-day list view (F12):** F5 is single-day. The upcoming bookings list view is F12.
- **Week view:** Not in v1. A week view is a separate feature, v2 or later.
- **Print / PDF export:** Out of scope for v1 entirely (see §10, OQ-5).
- **Real-time multi-device booking sync:** v1 is single-user; no WebSocket subscription for booking data updates.
- **Bookings crossing midnight:** A service that starts before midnight and extends into the next calendar day is out of scope for F5 rendering. F7 should prevent such bookings from being created. If one exists (e.g., data migration or direct DB insert), F5 clips the block at closing time and shows a visual indicator of truncation. F5 does not attempt to span two calendar days.
- **Pending or tentative booking status:** F5 displays confirmed bookings only (status set defined by the architect in the bookings ADR). Status handling for pending or tentative bookings is F7's domain.

---

## 5. Data model implications (flags for architect — no schema decisions here)

F5 is a read-only consumer of booking data. The architect must decide all schema details in the bookings ADR. F5 flags the following implications:

**Minimum fields F5 needs to read from a booking record:**
- Booking date and start time, resolvable to `America/Cancun` local time for display (architect decides UTC storage vs. local storage approach)
- Booking duration in minutes (either via JOIN to `services`, or snapshotted on the booking row — see duration snapshot note below)
- Assigned therapist ID (foreign key to `therapists`)
- Service name for display (either via JOIN or snapshotted — same historical-accuracy argument as price)
- Customer name or reference for display (architect decides JOIN vs. denormalized based on F9 customer model)
- Booking status (to exclude cancelled bookings per OQ-3)
- Studio ID (for RLS scoping)

**Duration snapshot note:** F4 (Service Catalog) established that `base_price_mxn` is snapshotted on the booking record for historical accuracy — if a service price changes, past bookings show the original price. The same argument applies to service duration: if a 60-minute service is later edited to 90 minutes, a booking made under the old duration should still display as 60 minutes on the schedule. The architect should snapshot `duration_minutes` on the booking row for the same reason. F5 flags this implication; the decision belongs in the bookings ADR.

**Timezone storage:** All times are `America/Cancun` (UTC-5, permanently, no DST since 2015 in Quintana Roo). The architect must document the storage approach. F5 has no opinion on storage format, but requires that the frontend receives the local time without needing to perform timezone conversion logic in UI layer code.

**RLS pattern:** F5 reads bookings scoped by studio. The pattern established across F1–F4:
```
auth.uid() = (SELECT owner_id FROM studios WHERE id = bookings.studio_id)
```
must be applied to the `bookings` table. The exact join path (whether `bookings` carries `studio_id` directly or joins via `therapists`) is the architect's call. F5 requires the pattern be confirmed in the ADR and tested with pgTAP per ADR-0003 conventions.

---

## 6. Edge cases and error states

- **Zero active therapists:** Schedule renders `schedule.emptyState.noTherapists.*` with a CTA to `/studio/therapists`. Does not crash or show an empty time grid with no context.
- **Studio profile incomplete (no operating hours set):** Rail defaults to 8:00 AM – 8:00 PM with `schedule.warning.hoursNotSet.*` warning banner and CTA to `/studio/profile`. The page does not block rendering.
- **Booking blocks overlapping in the same therapist column:** F5 renders both blocks visually. Conflict resolution belongs to F7. See AC 3.4 criterion 19.
- **Deactivated therapist with future confirmed bookings:** If a therapist is deactivated (F3) but has confirmed bookings on the viewed date, the bookings exist in the database but the therapist has no column. Those orphaned bookings are not rendered on the schedule. The deactivation warning in F3 ("this therapist may have upcoming bookings") is the primary safeguard. F5 does not add a secondary warning for this case.
- **Studio closed on viewed day:** Renders `schedule.closedDay.*` instead of the time rail. Day navigation controls remain active so the owner can move to an open day.
- **Operating hours not configured at all:** Fallback to 8:00 AM – 8:00 PM + warning banner. See AC 3.8 criterion 41.
- **Session crossing midnight:** Clips at closing time with a visual truncation indicator. The architect should decide whether F7 blocks such bookings at creation time. F5 does not crash or render negative-height blocks.
- **DST:** Not applicable. `America/Cancun` (Quintana Roo) has been permanently UTC-5 since February 2015. No DST handling is required anywhere in v1.
- **Long operating day (e.g., 7:00 AM – 10:00 PM, 15-hour rail):** At 30-minute ticks, this is 30 rows. The rail scrolls vertically within the page body scroll. No fixed-height constraint on the rail.
- **Network failure on page load:** Show `schedule.error.fetchFailed.*` with retry button. Do not show blank white page.
- **Network failure on day navigation:** Keep the current day's schedule visible; show toast error; do not commit the URL change. See AC 3.5 criterion 28.
- **Very large booking count (10+ bookings in one day):** No pagination is required in F5. All confirmed bookings for the viewed date and studio are fetched and rendered. A studio with 2 therapists and 8-hour days of 1-hour appointments would have at most ~16 bookings — well within a single page load.
- **Concurrent session on another device:** If another device creates a booking while the owner is viewing the schedule, the new booking does not appear until the owner reloads or re-navigates (see AC 3.9 criterion 43). This is accepted behavior for v1.

---

## 7. Analytics and success metrics

All events are fired server-side (NestJS) on API call, or where noted, client-side for navigation actions that precede the fetch. `studio_id` is always included; customer names and other PII are never included in event properties.

| Event | Properties | When fired |
|---|---|---|
| `schedule_viewed` | `studio_id`, `date_viewed: string (YYYY-MM-DD)`, `is_today: bool`, `therapist_count: int`, `booking_count: int` | On successful booking data response for a date |
| `schedule_day_navigated` | `studio_id`, `direction: 'prev' \| 'next' \| 'today' \| 'picker'`, `date_target: string (YYYY-MM-DD)` | Client-side, on each navigation action before the fetch |
| `schedule_fetch_error` | `studio_id`, `date_requested: string (YYYY-MM-DD)`, `error_type: 'network' \| 'server'`, `status_code: int \| null` | On failed booking data fetch |

**Success metrics:**

- Primary: ≥1 `schedule_viewed` event per studio per working day within 7 days of the studio's first confirmed booking. Proxy for "owners use the schedule as their daily anchor."
- Leading indicator: Mean `schedule_viewed` events per active studio per day, measured over the first 30 days post-onboarding. No baseline; track to establish. Target is daily use (≥1/day).
- Layout hypothesis metric (qualitative, not event-driven): During the Feature 14 validation demo, the studio owner correctly identifies which column belongs to which therapist within 10 seconds of first viewing the schedule. If this fails, the column-per-therapist hypothesis is falsified. See §11 (Risk register) and §12 (Validation hooks).
- Health: `schedule_fetch_error` event rate below 0.5% of `schedule_viewed` events in production (Supabase latency baseline; any sustained rate above this indicates a systemic issue).

---

## 8. Roles and permissions

- **Studio owner (authenticated):** Read access to their own studio's bookings for any date, scoped by RLS. No write access via the schedule view (F5 is a read-only view).
- **Therapist:** No login, no access in v1.
- **Customer:** No access in v1.
- **Unauthenticated:** Middleware redirects to login before any booking data is fetched or rendered.

**RLS dependency:** The `bookings` table must carry a `studio_id` column (or be joinable to `studios` via `therapist_id → therapists.studio_id`) to enable the standard RLS pattern. Architect confirms the join path in the bookings ADR and adds pgTAP tests per ADR-0003 conventions. F5 is the first feature to read from the `bookings` table — any RLS misconfiguration will surface immediately in the schedule view.

**Supabase keep-alive (project MEMORY.md note):** The keep-alive ping must use `/auth/v1/settings` (not `/rest/v1/` root, which returns 401 for the anon key). This is an existing project memory entry, not a new F5 concern. Noted here because F5 makes frequent booking queries — a paused Supabase project produces 503 errors that surface immediately on the schedule. Architect should verify keep-alive is confirmed working before F5 goes to staging.

---

## 9. Localization

All user-facing strings ship with both `es` and `en` keys (next-intl), under the `schedule.*` namespace. Spanish is canonical; English ships in parallel. No string launches `es`-only. The next-intl TypeScript augmentation (`createMessagesDeclaration`) causes a build-time error if any key is missing from `messages/es.json` — this is the enforcement mechanism.

```
schedule.page.title                           es: "Agenda del día"                              en: "Daily schedule"
schedule.page.subtitle                        es: "Vista de hoy por terapeuta"                  en: "Today's view by therapist"

schedule.nav.previousDay                      es: "Día anterior"                                en: "Previous day"
schedule.nav.nextDay                          es: "Día siguiente"                               en: "Next day"
schedule.nav.today                            es: "Hoy"                                         en: "Today"
schedule.nav.datePicker.label                 es: "Ir a fecha"                                  en: "Go to date"
schedule.nav.datePicker.placeholder           es: "Seleccionar fecha"                           en: "Select date"

schedule.booking.unknownCustomer              es: "Cliente desconocido"                         en: "Unknown customer"
schedule.booking.duration                     es: "{n} min"                                     en: "{n} min"

schedule.emptyState.noTherapists.title        es: "Aún no tienes terapeutas"                    en: "You don't have any therapists yet"
schedule.emptyState.noTherapists.body         es: "Agrega terapeutas para ver su agenda aquí."  en: "Add therapists to see their schedule here."
schedule.emptyState.noTherapists.cta          es: "Gestionar terapeutas"                        en: "Manage therapists"

schedule.emptyState.noBookings.title          es: "Sin citas para este día"                     en: "No bookings for this day"
schedule.emptyState.noBookings.body           es: "Este día no tiene citas programadas."         en: "No bookings are scheduled for this day."
# NOTE: `schedule.emptyState.noBookings.*` is conditional on OQ-1. If Gate 1 keeps the "+" placeholder
# default (OQ-1), this pair is unused and SHOULD be dropped before implementation to avoid an unused-key
# build warning. If Gate 1 flips OQ-1 to "white space", this pair is rendered as the column-level empty state.

schedule.closedDay.title                      es: "Estudio cerrado"                             en: "Studio closed"
schedule.closedDay.body                       es: "El estudio no opera este día según sus horarios."  en: "The studio is not operating on this day according to its hours."

schedule.warning.hoursNotSet.title            es: "Horarios sin configurar"                     en: "Hours not configured"
schedule.warning.hoursNotSet.body             es: "Configura el horario de tu estudio para ver la agenda correctamente."  en: "Set your studio hours to see the schedule correctly."
schedule.warning.hoursNotSet.cta              es: "Configurar horarios"                         en: "Set hours"

schedule.nowIndicator.label                   es: "Ahora"                                       en: "Now"

schedule.error.fetchFailed.title              es: "Error al cargar la agenda"                   en: "Failed to load schedule"
schedule.error.fetchFailed.body               es: "No se pudo obtener la información de citas. Intenta de nuevo."  en: "Could not fetch booking information. Please try again."
schedule.error.fetchFailed.retry              es: "Reintentar"                                  en: "Retry"

schedule.toast.navError.title                 es: "Error al navegar"                            en: "Navigation error"
schedule.toast.navError.body                  es: "No se pudo cargar el día seleccionado. Intenta de nuevo."  en: "Could not load the selected day. Please try again."

schedule.slotPlaceholder.addBooking           es: "+ Agregar cita"                              en: "+ Add booking"

schedule.loading.label                        es: "Cargando agenda..."                          en: "Loading schedule..."

schedule.accessibility.bookingBlock           es: "{serviceName} con {customerName}, {startTime} – {endTime}"  en: "{serviceName} with {customerName}, {startTime} – {endTime}"
schedule.accessibility.therapistColumn        es: "Columna de {therapistName}"                  en: "{therapistName}'s column"
```

**Date header formatting:** Rendered via next-intl `format.dateTime` with `{ weekday: 'long', day: 'numeric', month: 'long' }`. Example output: "lunes, 16 de mayo" (es) / "Monday, May 16" (en). The exact format pattern is the designer's decision; the spec requires locale-aware rendering and prohibits hardcoded date strings.

**Accessibility string note:** `schedule.accessibility.bookingBlock` is the accessible label applied to each booking block for screen readers. It uses interpolation to include service name, customer name, and time range. This is a required string even though it has no visible rendering.

---

## 10. Open questions — resolve at Gate 1

Each question has a default recommendation. The human resolves these before the designer or architect begin. Unresolved questions block implementation.

| # | Question | Default recommendation | Rationale |
|---|---|---|---|
| OQ-1 | Empty slot rendering: white space or clickable "+" placeholder | **"+" placeholder** (`schedule.slotPlaceholder.addBooking.*`) | Sets up F7's entry point from the schedule view. Placeholder is visual-only in F5 (no click handler yet — F7 adds it). If white space is chosen, F7 must later add click affordance to the empty rail. |
| OQ-2 | Closed-day rail: show full time rail or collapsed closed-day message | **Collapsed closed-day message** (`schedule.closedDay.*`) | A full time rail on a closed day implies availability that does not exist, which is misleading. A clear closed-day state prevents the owner from trying to create bookings on a day the studio is not operating. |
| OQ-3 | Cancelled bookings on the view: hidden, greyed, or struck-through | **Hidden** (not rendered) | Cancelled bookings add visual noise to the primary daily view. Historical review of cancellations is not a F5 use case. If the owner needs to see cancellations, that is a reporting/history feature (post-v1). |
| OQ-4 | Time rail tick granularity: 15-minute, 30-minute, or 60-minute ticks | **30-minute ticks** | 15-min is too dense for desktop (30 rows per hour; 450 rows for a 15-hour day). 60-min loses resolution for the typical 60–90 min massage slot. 30-min is the correct resolution for the primary use case. Designer may refine. |
| OQ-5 | Print / PDF view of the daily schedule | **Out of scope for v1** | Not tied to the 90-day success metric. Add to the v2 backlog. If owners request it during the Feature 14 demo, escalate. |
| OQ-6 | Therapist column ordering | **Alphabetical by name** (default); respect `order_index` if architect adds it to `therapists` | F3 (Therapist Roster) does not define a display order today. Alphabetical is a stable, deterministic default. Explicit ordering is a nice-to-have for a future iteration. |
| OQ-7 | Studio operating hours not configured (null): fallback rail or onboarding block | **Fallback to 8:00 AM – 8:00 PM with warning banner** | Blocking the entire schedule for missing hours is too harsh during early onboarding. A soft warning with a CTA to complete the profile allows the owner to see a useful schedule even before setup is 100% complete. |
| OQ-8 | Hard navigation limit on past/future date navigation | **No hard limit** | Historical dates are useful for the owner reviewing past sessions. Future dates are useful for planning. API returns empty booking lists for future dates with no bookings — no special handling needed. Architect may add a reasonable query window for performance (e.g., reject dates more than 2 years out) but the UI should not enforce a UI-level limit. |

**Dependency constraints (not open questions — hard boundaries):**

- **F6 coupling:** F6 adds per-therapist availability shading to the schedule. F5 must not paint availability shading. When F6 ships, the schedule view will require a UI update. The architect should design the F5 data fetch to be extensible to include F6 availability data in a future request without a schema migration on the frontend.
- **F7 coupling:** F5 renders the "+" slot placeholder as a static visual. F7 adds the click handler. F5 and F7 may be built in parallel if the placeholder has no JS action in the F5 implementation. The interface between them (how F7 registers the click handler) is the architect's and designer's decision.

---

## 11. Risk register

### RISK_HIGH — Column-per-therapist layout assumption is unvalidated

**Description:** The daily column-per-therapist grid is the highest-risk UI hypothesis in v1. It mirrors common scheduling tools (salon booking software, Google Calendar multi-person view) but has not been shown to a real Tulum studio owner. The owner may find a list view, a single-therapist tap-to-switch view, or a week-at-a-glance more intuitive for how they mentally track their day in a WhatsApp-native workflow.

**Source:** Roadmap Assumption 4 (HIGH RISK flag, 2026-04-26): "A daily, multi-column timeline (one column per therapist) is the right primary UI for the owner. Alternatives (weekly, list-first) may be preferred. Test early."

**Kill criteria — what falsifies the column-per-therapist assumption:**
- During the Feature 14 validation demo, the studio owner cannot identify which therapist's column they are looking at within 10 seconds of first viewing the schedule (orientation failure).
- The owner verbally frames the grid as confusing or says they would not use it as their primary view.
- The owner cannot locate a specific booking by therapist within 30 seconds, unaided.
- The owner expresses preference for a list view or requests to see bookings in a single chronological stream rather than by column.

**Mitigation (two-stage):**
1. The designer prototypes the layout (lo-fi, not code) and shows it to one real studio owner before any implementation begins. This is a gate in the Definition of Done (§13). If the prototype fails at this stage, the layout is revised before code is written — low cost.
2. Feature 14 (validation checkpoint after F5–F8 are live) is the second circuit-breaker. The §12 Validation Hooks section defines exactly what to observe during the F14 demo for F5 specifically.

**If the layout fails:** Pivot to a list-first daily view (analogous to Google Calendar's "Schedule" view — a flat chronological list with therapist names inline). The list-first view is lower development cost, works at any screen size, and would be the fallback path. The backend API contract does not change — only the rendering.

**Cross-reference:** Feature 14 (validation checkpoint), §12 Validation Hooks.

### RISK_MEDIUM — Booking data model not yet defined (F7 blocker)

**Description:** F5 reads booking data, but the booking record schema is defined in F7's ADR (which does not exist yet). If F7's data model changes significantly after F5 is built, F5's data layer may need rework.

**Mitigation:** The architect produces the bookings ADR before either F5 or F7 implementation begins. F5 and F7 should not be coded before the ADR is approved.

### RISK_LOW — Supabase project pause during active use

**Description:** Supabase pauses free-tier projects after 7 days of inactivity. F5's frequent booking queries would surface a paused project as 503 errors on the schedule fetch — immediately visible to the owner.

**Mitigation:** The keep-alive workflow (`.github/workflows/keep-alive.yml`) pings `/auth/v1/settings` every 3 days (per project MEMORY.md note — `/rest/v1/` root returns 401 for the anon key). Architect should verify the keep-alive is confirmed working before F5 goes to staging. No additional action required for F5 itself.

---

## 12. Validation hooks — Feature 14 demo script (F5-specific)

The Feature 14 validation checkpoint (after F5–F8 are live) is the primary risk-mitigation mechanism for the column-per-therapist assumption. The following is the structured observation script for F5 specifically. Record all reactions verbatim and document in `docs/research/` immediately after the session.

**Setup:** Navigate to today's schedule with at least 3–4 bookings visible across 2 therapists. Do not explain the layout before the owner sees it. Hand them the device and observe.

**Observe (do not prompt until the observation window closes):**
1. Time-to-orientation: How long before the owner understands what they are looking at? Count silently. Target: under 10 seconds. Failure threshold: 30 seconds of confusion.
2. Therapist identification: Can the owner point to each therapist's schedule without being told which column is which?
3. Time reading: Ask them to tell you when a specific booking starts. Do they read the time rail correctly?
4. Empty slot interpretation: Do they understand open space (or "+" placeholders) as "available"? Do they spontaneously ask how to add a booking?
5. Day navigation: Ask them to look at tomorrow's schedule. Do they find the navigation controls within 15 seconds without instruction?
6. Mobile test: If they use a phone for work, show the mobile view and record their first reaction.

**Ask explicitly (after observation window):**
- "Is this how you picture your day when you're working?"
- "What would you want to see here that you don't see?"
- "Would you open this app instead of WhatsApp every morning? Why or why not?"
- "If you had 3 or 4 therapists, would this still work for you?"
- "How would you describe this to another studio owner?"

**Decision gate:** If any RISK_HIGH kill criterion from §11 is triggered during the demo, escalate to the human before continuing. Do not proceed with P1 features (F6, F9, F10, F12) until the human decides whether to continue with the column layout or pivot.

---

## 13. Definition of done

### Product-level (gate before implementation begins)

- [ ] Gate 1: Human reviews and approves this spec. Open questions in §10 are resolved and documented.
- [ ] Designer reads the approved spec and produces a lo-fi prototype (not code) covering: column layout, time rail, booking block, now indicator, day navigation controls, empty states (no therapists, no bookings, closed day), and the mobile adaptation approach. Prototype saved to `docs/design/feature-5-schedule-prototype.md` or equivalent.
- [ ] Human or designer shows the prototype to at least one real Tulum studio owner and documents their reaction in `docs/research/`. If this is not feasible before coding starts, the human explicitly accepts the risk in writing and proceeds — the risk is noted in §11.
- [ ] Architect reads the approved spec and produces the bookings ADR (data model, status enum, timezone storage, duration snapshot decision, RLS pattern, API endpoint shape for the F5 read). ADR saved to `docs/adr/`. ADR approved before any F5 or F7 code is written.
- [ ] Booking record shape is locked in the ADR before F5 or F7 implementation begins.

### Code-level (gate before PR merge)

- [ ] Page renders at `/studio/schedule` for an authenticated owner.
- [ ] `?date=YYYY-MM-DD` parameter correctly loads the specified date; invalid parameter falls back to today.
- [ ] Day navigation (prev, next, today, date picker) updates URL and re-fetches without full page reload.
- [ ] "Now" indicator renders on today's view and updates automatically once per minute.
- [ ] Deactivated therapists absent from schedule; active therapists each have one column.
- [ ] Empty states render correctly: no therapists, no bookings, closed day, hours not configured.
- [ ] Booking blocks render at correct position and proportional height for at least 3 test bookings of varying durations (30 min, 60 min, 90 min).
- [ ] Overlapping booking blocks in the same column: both are visible (no silent data loss).
- [ ] Error state renders on simulated network failure; retry button triggers re-fetch.
- [ ] All `schedule.*` i18n keys present in both `messages/es.json` and `messages/en.json`. Build fails if any key is missing.
- [ ] RLS: authenticated owner A cannot fetch studio B's bookings. Verified by pgTAP test in `supabase/tests/rls_bookings_test.sql`.
- [ ] Responsive: no horizontal scroll on page body at 375px (`document.documentElement.scrollWidth === 375`). Schedule grid may scroll within its container.
- [ ] All navigation controls meet 44×44px touch target at 375px viewport.
- [ ] Accessibility: skip link present; landmarks correct (`<main id="main-content">`); booking blocks have `aria-label` via `schedule.accessibility.bookingBlock.*`; now indicator has `aria-label`; icon-only buttons have `aria-label`; `<html lang>` attribute matches active locale.
- [ ] `schedule_viewed` event fires correctly on successful data load (verified in NestJS server logs in staging).
- [ ] `schedule_day_navigated` event fires on each navigation action (verified in staging).
- [ ] CI green: lint, typecheck, test, build, RLS tests all pass.

---

## 14. Open decisions reserved for designer and architect

These are explicitly NOT answered in this spec. Spec answers "what" and "why"; these agents answer "how."

**Designer decisions:**
- Exact visual style of booking blocks: background color (brand palette vs. semantic vs. custom), border, typography, truncation at minimum block height.
- Visual style of the "now" indicator: color, line weight, label placement, animation (must respect `prefers-reduced-motion` per `docs/design/accessibility.md` §5).
- Therapist column header design: avatar, name truncation at narrow widths, visual treatment for a deactivated therapist who has historical bookings visible (if that case arises).
- Column width approach: fixed equal width, or proportional to remaining viewport width.
- "+" slot placeholder visual design: button-like vs. text-only vs. icon+text; hover/active states; whether it renders for every 30-min slot or only on hover.
- Day navigation layout: are prev/next icon-only or labelled? Placement of date picker relative to date display.
- Closed-day state visual: full-height message with illustration, or slim banner above the navigation.
- Mobile adaptation decision: horizontal-scroll-within-grid vs. single-therapist-selector with swipe. The spec requires at minimum the horizontal-scroll approach; the selector upgrade is at the designer's discretion within the F5 scope.
- Date header format pattern: `EEEE d 'de' MMMM` (es) vs. other patterns — exact format is the designer's call, using next-intl's `format.dateTime`.
- Booking block tap state in F5 (before F8): does tapping a booking do anything (e.g., show a subtle highlight) or is it purely visual? Deferred to designer.

**Architect decisions:**
- Bookings table schema: columns, data types, indexes, status enum values and their display semantics.
- Timezone storage approach: UTC timestamp, local timestamp without timezone, or local `HH:MM` string (consistent with what F2 established for studio hours).
- Duration and service-name snapshot on booking record (vs. JOIN): which approach, and how it interacts with historical accuracy.
- Customer name on booking: JOIN to a `customers` table (F9) or denormalized field — architect decides based on F9 model and F7 creation flow.
- API endpoint design: route (`GET /api/schedule?date=YYYY-MM-DD` vs. others), response shape, HTTP caching headers (if any).
- Therapist column ordering: whether `order_index` is added to `therapists` table and how ties are broken.
- RLS policy for `bookings`: exact SQL, join path, helper function reuse per ADR-0003 pattern.
- F5 data fetching strategy: React Query, SWR, Next.js server component with streaming, or direct fetch — architect decides consistent with patterns established for other features. ADR-0006 (CSP middleware with per-request nonce) constrains client-side data-fetching choices; the architect must document compatibility in the F5 ADR.
- F5 + F7 interface: how F7 wires the click handler onto the F5 "+" placeholder (prop injection vs. shared component vs. route co-location).

**ADRs the architect should cross-reference (not author here):**
- ADR-0003 — RLS / pgTAP conventions (applies to the new `bookings` table)
- ADR-0006 — CSP middleware with per-request nonce (applies to any inline script-based data fetch or hydration approach in the schedule page)
- Any ADR established by F4 for the `services` data-fetching pattern (architect to verify and reuse)

---

## 15. Gate 1 decisions

Resolutions to §10 open questions, captured here when the human (or autonomous reviewer with explicit authority) approves the spec for handoff to designer and architect. Until every row is filled, the spec is in draft and downstream work should not start.

| # | Question | Resolution | Decided by | Date |
|---|---|---|---|---|
| OQ-1 | Empty slot rendering | _pending_ | _pending_ | _pending_ |
| OQ-2 | Closed-day rail | _pending_ | _pending_ | _pending_ |
| OQ-3 | Cancelled bookings on view | _pending_ | _pending_ | _pending_ |
| OQ-4 | Time rail tick granularity | _pending_ | _pending_ | _pending_ |
| OQ-5 | Print / PDF view | _pending_ | _pending_ | _pending_ |
| OQ-6 | Therapist column ordering | _pending_ | _pending_ | _pending_ |
| OQ-7 | Studio hours not configured | _pending_ | _pending_ | _pending_ |
| OQ-8 | Hard navigation limit | _pending_ | _pending_ | _pending_ |

**Resolution policy:** Each resolution must either accept the §10 default recommendation verbatim or explicitly state a different choice with a one-line rationale. A blank or ambiguous resolution is not approval.
