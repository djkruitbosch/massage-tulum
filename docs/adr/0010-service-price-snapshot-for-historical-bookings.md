# ADR 0010: Service Price Snapshot for Historical Booking Integrity

**Status:** Accepted
**Date:** 2026-05-14
**Author:** architect (agent)
**Context tickets:** CU-869d29f21

## Context

Spec §3 "Edit service" #2 requires that when `base_price_mxn` is edited on a service, any past booking record continues to display the price in effect at booking time. The product requirement is unambiguous; the mechanism is the architect's decision.

Three options were surveyed (per spec §10 item 1):

**(a) Denormalized price snapshot column on the booking row.** A `price_snapshot_mxn` integer column is added to the future `bookings` table at the moment a booking is created. The value is copied from `services.base_price_mxn` at booking creation time and is never updated again. Price changes to the service record do not affect the snapshot. Queries simply read `bookings.price_snapshot_mxn`.

**(b) Price-version / ledger table with effective-from timestamps.** A `service_price_versions` table stores `(service_id, price_mxn, effective_from timestamptz)`. When `base_price_mxn` is edited, a new version row is inserted. The booking record stores only a `service_id` FK; historical price is reconstructed by joining to the version row where `created_at >= effective_from AND created_at < next_version.effective_from`. Requires a range query on every booking price lookup.

**(c) Event-sourced service.** All state changes are stored as immutable domain events; current state is projected from the event log. Provides the richest audit trail but adds substantial infrastructure overhead (event store, projection logic, replay tooling).

Forces at play:

- **Supabase RLS compatibility.** Option (b) requires a separate `service_price_versions` table, which needs its own RLS policies, pgTAP tests, and migration. It also makes the join on the booking read path more complex — the policy must consider temporal joins. Option (a) collapses this: `bookings.price_snapshot_mxn` is just another column on the booking row, covered by the same RLS policy as the rest of the booking.

- **v1 has no bookings table yet.** The `services` table can be implemented now with no structural change needed to satisfy the historical integrity requirement. The snapshot approach defers the obligation entirely to the `bookings` migration: when bookings are specced and implemented, the developer simply includes `price_snapshot_mxn integer NOT NULL` in the `CREATE TABLE bookings` DDL and sets it at INSERT time. No backfill needed.

- **v2 Stripe integration.** Stripe expects amounts in centavos (smallest currency unit). The current decision stores prices as whole pesos (`base_price_mxn integer`). A centavo-conversion layer (`price_snapshot_mxn * 100`) will be needed when the Stripe charge is constructed. This conversion is a v2 concern — the snapshot stores what was charged to the customer in the display unit (pesos), and Stripe's centavo multiply happens in the payment-intent creation logic, not in the snapshot itself. No schema change is required at v2 for the snapshot column; only the Stripe-side multiply layer needs to be added.

- **Simplicity for a single-developer v1.** Option (a) requires zero additional tables, zero additional RLS policies, zero additional pgTAP test files, and zero join complexity. Option (b) adds a whole domain object (price versioning) for an edge case (price edits) that, in v1 with 1–10 studios, will rarely be triggered. Option (c) is entirely unjustified at this scale.

**Extensibility hook (therapist write access, v2+).** If therapists eventually gain read access to bookings (v2+), they will see the snapshot price naturally — no special handling needed because it is a plain column. The RLS policies on `bookings` will govern what therapists can read.

## Decision

**Option (a): Denormalized price snapshot column on the booking row.**

When the `bookings` table is created (separate future ticket), the DDL must include:

```sql
price_snapshot_mxn  integer  NOT NULL  CHECK (price_snapshot_mxn >= 0)
```

This column is populated at booking INSERT time by copying the current `services.base_price_mxn`. It is never updated after the booking is created. The NestJS booking service is responsible for reading `services.base_price_mxn` and writing it into `bookings.price_snapshot_mxn` within the same transaction that creates the booking.

The `services` table itself requires no structural changes to satisfy this requirement.

**MXN whole-peso storage (v2 Stripe seam).** The snapshot stores whole pesos (integer). At v2 Stripe integration, the payment-intent creation code multiplies by 100 to get centavos. This is a single-line conversion in the payment service; no migration is needed to the snapshot column. The future ADR for Stripe integration must document this conversion.

## Consequences

- **Positive:**
  - Zero additional tables for the current sprint. The `services` migration is unaffected.
  - RLS policies remain simple: the booking row's price is just another column, covered by booking-level policies.
  - No temporal join on booking reads. Price is always available at O(1) from the booking row itself.
  - v2 Stripe centavo multiply is a local concern in the payment service, not a schema concern.
  - No backfill complexity — historical bookings before any future price edits already contain the correct snapshot.

- **Negative:**
  - Price data is duplicated (once in `services.base_price_mxn`, once per booking in `price_snapshot_mxn`). This is intentional denormalization for read simplicity.
  - A future "revenue reconciliation" report that needs to cross-reference current price vs. charged price must join `bookings.price_snapshot_mxn` against `services.base_price_mxn` explicitly. This is straightforward.

- **Neutral / follow-up work:**
  - The `bookings` migration (future ticket) must include `price_snapshot_mxn integer NOT NULL CHECK (price_snapshot_mxn >= 0)`.
  - The NestJS booking service must copy `services.base_price_mxn → bookings.price_snapshot_mxn` at booking creation time.
  - The future Stripe ADR must document the `price_snapshot_mxn * 100` centavo conversion.
  - Multi-user concurrent edit note (spec §5): last-write-wins on `services.base_price_mxn` is acceptable in v1. No optimistic locking implemented. If two concurrent edits occur, the last write wins and future bookings get that price. Past bookings are unaffected because they hold their own snapshot.

## Alternatives considered

**Option (b) — price-version/ledger table.** Rejected for v1. Adds an entire table, RLS policies, pgTAP test file, and temporal join logic to every booking price lookup. The benefit (complete audit trail of all price changes) is not required by any v1 spec. It is the right long-term solution if the platform adds price-change analytics or compliance requirements; it can be introduced in a future ADR without breaking the snapshot approach (both can coexist — snapshot remains the fast path; ledger becomes the audit log).

**Option (c) — event-sourced service.** Rejected. No event store infrastructure exists or is planned. Adding it for a single price-integrity requirement would be a significant over-engineering of the system.

## Implementation notes

- **`services` migration (BE-1 for this ticket):** No snapshot column needed. The `services` table only needs `base_price_mxn integer NOT NULL CHECK (base_price_mxn >= 0)`.
- **`bookings` migration (future ticket):** Add `price_snapshot_mxn integer NOT NULL CHECK (price_snapshot_mxn >= 0)` to the `CREATE TABLE bookings` DDL. Reference this ADR in the migration comment.
- **NestJS booking service (future ticket):** In the `createBooking` method, resolve the service's current `base_price_mxn` and write it to `price_snapshot_mxn` in the same `INSERT` statement. Do not allow the caller to supply the snapshot value — it is always server-derived.
- **Stripe v2:** The payment-intent creation code must use `booking.price_snapshot_mxn * 100` as the Stripe `amount` (centavos). The future Stripe ADR is the authoritative reference for this conversion.
