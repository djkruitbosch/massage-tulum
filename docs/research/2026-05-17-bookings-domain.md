# Research: Bookings Domain — Six Pre-Architecture Questions

**Tickets:** CU-869d29f2c (Manual booking creation, F7), CU-869d29f2d (Reschedule + cancel, F8)
**Date:** 2026-05-17
**Author:** worker-04 (researcher mode)
**Requested by:** worker-04 self-handoff from F7 §10
**Decision deadline:** Blocking — architect cannot author the bookings ADR until R1, R4, R5, R6 are resolved. R2 and R3 are non-blocking confirmations.

* * *

## Constraints (from CLAUDE.md / existing ADRs / shipped specs)

- Stack locked: Next.js 15 App Router on Vercel, NestJS on Hetzner/Coolify, Supabase Postgres + Auth, Brevo SMTP, next-intl. (CLAUDE.md, ADR-0001..0011.)
- Supabase managed Postgres only — no self-hosted DB. Extensions must be ones Supabase ships.
- RLS is mandatory (ADR-0003); studio-scoped resource pattern (ADR-0011).
- Timezone is fixed to `America/Cancun`, UTC-05 year-round, no DST (Studio Profile spec §74, Feature 5 spec §175, roadmap 2026-04-26 decision).
- Studio operating hours and therapist working hours store as **plain local `HH:MM`** (Studio Profile spec line 171; Therapist Roster spec is the same shape). The bookings table is the first place v1 needs absolute moments in time.
- Phone numbers across v1 store as **E.164**, normalized by NestJS via `libphonenumber-js` (architecture `CU-869d29f1h-studio-profile.md` line 288).
- Solo developer; v1 traffic is ~1 studio × ~14 bookings/day. Read volume is modest.

* * *

## R1 — Therapist-overlap prevention: `tstzrange` + `EXCLUDE USING GIST` vs. transactional pre-check

### Question

How does the bookings table prevent two `confirmed`/`pending` bookings for the same therapist from overlapping in time, race-safely, returning a clean error code the API can translate?

### Constraints recap

- Must work under Supabase RLS without holding `SERIALIZABLE` transactions.
- Must include `cancelled` bookings in the table but exclude them from the overlap check (F7 spec §3.2 #3).
- Must produce a distinguishable error (not a generic `23505` or `23514`) so the NestJS layer can map it to a 409 `therapist_double_booked`.
- F8 (reschedule) will rewrite `start_time`/`end_time` on existing rows — the constraint must hold across UPDATE as well as INSERT.

### Option A — `EXCLUDE USING GIST` with a partial predicate

Use a Postgres exclusion constraint over a `tstzrange` column (or `tsrange` if we go local-time, see R4) plus `therapist_id`, restricted to non-cancelled rows.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  ADD COLUMN time_range tstzrange GENERATED ALWAYS AS
    (tstzrange(start_time, end_time, '[)')) STORED;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    therapist_id WITH =,
    time_range   WITH &&
  ) WHERE (status IN ('confirmed', 'pending'));
```

- **Race-safety:** guaranteed by Postgres — the constraint is checked under the same lock as the INSERT/UPDATE. Two concurrent inserts cannot both succeed; one returns SQLSTATE `23P01` (`exclusion_violation`).
- **Cancelled bookings:** never participate (the `WHERE` predicate filters them out at index level).
- **UPDATE behavior:** F8's reschedule moves `start_time`/`end_time`; the generated `time_range` recomputes; the constraint re-evaluates. No bespoke logic needed.
- **Error code translation:** SQLSTATE `23P01` plus constraint name `bookings_no_overlap` is unambiguous. NestJS maps it to 409 `therapist_double_booked`.
- **Required extension:** `btree_gist`. Available on Supabase but **not enabled by default** — must `CREATE EXTENSION btree_gist;` in a migration (Source 1, 2). The extension is a stock PostgreSQL contrib module; no licensing or version concerns.

### Option B — Transactional pre-check in NestJS

NestJS opens a `SERIALIZABLE` transaction, runs `SELECT FOR UPDATE` over the candidate range, asserts no overlap in application code, then INSERTs.

- **Race-safety:** only if every booking write goes through this code path AND the isolation level is honored. Direct SQL (psql, migrations, future Supabase functions) bypasses it.
- **Cancellation handling:** correct, but the predicate lives in app code rather than the database. Duplicated risk across F7 (create) and F8 (reschedule).
- **Performance:** acceptable at v1 scale; SERIALIZABLE retry storms become an issue at higher concurrency (not a v1 concern).
- **Failure mode:** harder to distinguish "rejected for overlap" from "rejected for unrelated serialization failure." Error-code translation in the API layer becomes brittle.

### Recommendation

**Option A (`EXCLUDE USING GIST`).** The database enforces the invariant — no future bypass risk, no app-code duplication between F7 and F8, race-safe by construction, and the error code is unambiguous. The only setup cost is one line in a migration: `CREATE EXTENSION IF NOT EXISTS btree_gist;`.

### Concrete instructions for the architect

1. Migration adds `btree_gist` extension (idempotent), then `bookings.time_range` as a `GENERATED ALWAYS AS` column, then the exclusion constraint.
2. NestJS `BookingsService` catches `error.code === '23P01'` AND `error.constraint === 'bookings_no_overlap'` and throws a 409 with body `{ "error": "therapist_double_booked" }`. Anything else stays as a 500 (the constraint name disambiguator avoids false positives).
3. pgTAP test in `supabase/tests/rls_bookings_test.sql` covers: (a) two confirmed bookings same therapist same time → second INSERT fails with `23P01`; (b) one confirmed, one cancelled at the same time → both rows coexist; (c) two bookings whose ranges touch but don't overlap (one ends 10:00, next starts 10:00) → both succeed (the `[)` half-open range guarantees this).

* * *

## R2 — Mexican phone validation library (confirmation, not new research)

### Question

What library validates customer phone numbers for the inline-customer sub-form in F7 §3.4?

### Recommendation

**Reuse `libphonenumber-js`** — already adopted for studio profile and therapist roster (architecture `CU-869d29f1h-studio-profile.md` line 288, line 552). Normalize to E.164 in the NestJS DTO. No new library, no new ADR.

### Concrete instructions for the architect / developer

- `import { parsePhoneNumberWithError } from 'libphonenumber-js';` in the customers DTO/service.
- Parse with `parsePhoneNumberWithError(input, 'MX')`; store `.format('E.164')`.
- Per-studio uniqueness check (F7 §9 Gate 1 #8) runs against the normalized E.164 string, not the raw input.
- pgTAP doesn't need a phone test — the validation is in NestJS, not in the DB schema. Postgres just stores `text`.

* * *

## R3 — `Intl.DateTimeFormat` options for short-date + short-time across locales

### Question

What `Intl.DateTimeFormat` options render booking start times consistently across `es-MX` and `en-US`, forced to `America/Cancun`, and which clock convention (12-hour vs. 24-hour) per locale?

### Findings

- Browser/Node `Intl.DateTimeFormat` supports `timeZone: 'America/Cancun'` natively; Quintana Roo's tz database entry is stable (no DST since 2015 per IANA).
- Default `hour12` behavior is locale-dependent. Forcing it ensures cross-environment determinism.
- Mexican Spanish convention: 12-hour with `a.m.`/`p.m.` (lowercase, with periods) is dominant in customer-facing UI (banking, airline, ticketing apps surveyed). 24-hour appears in formal/government contexts. For a tourism-facing studio booking app, 12-hour is the natural fit.
- US English convention: 12-hour with `AM`/`PM` (uppercase) — universal.
- **Recommendation:** force 12-hour in both locales. This also keeps F5 (DJmain's daily schedule) and F7/F8 (this work) visually consistent without locale-specific branching for clock format.

### Recommended options

```ts
// Time component, e.g. "9:30 a.m." / "9:30 AM"
const fmtTime = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Cancun',
});

// Short-date + time used in toasts and confirmation strings
const fmtDateTime = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Cancun',
});
```

### Concrete instructions

- Centralize the formatters in `apps/web/lib/formatters/dateTime.ts` (or wherever F5's date formatters land — coordinate with DJmain so F5 and F7/F8 share the helper).
- Do **not** instantiate `Intl.DateTimeFormat` inside render bodies — instantiation is non-trivial; memoize at module scope.
- Vercel runtime is Node ≥20 (per `.nvmrc`); full ICU is bundled, so `es-MX` and `en-US` resolve correctly server-side. No extra `--icu` flag needed.

* * *

## R4 — `btree_gist` extension status on Supabase managed Postgres

### Question

Is the `btree_gist` extension available on Supabase's managed Postgres, and how is it enabled?

### Findings

- `btree_gist` is a stock PostgreSQL contrib module, available on Supabase managed Postgres but **not enabled by default**. (Sources 1, 2.)
- Enabled via `CREATE EXTENSION IF NOT EXISTS btree_gist;` inside a migration. The extension is created in the `extensions` schema by Supabase convention. The migration must be idempotent.
- Required for R1's exclusion-constraint approach because the constraint mixes a B-tree-compatible column (`therapist_id uuid`) with a GiST-compatible column (`tstzrange`).

### Concrete instructions

- The bookings migration's first statement is:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
  ```
- ADR for the bookings module should cite this extension dependency in its "Implementation notes" so future schema-drift checks know it is intentional.
- A clean migration on a fresh local Supabase (`supabase db reset`) should succeed without manual intervention; verify in CI's `ci/rls-test` job.

### Storage decision: `timestamptz` vs `timestamp`

Adjacent to R4 because it affects which range type to use. Two viable shapes:

| Shape | Storage | Range type | Pros | Cons |
| --- | --- | --- | --- | --- |
| **A: UTC `timestamptz`** | `start_time timestamptz NOT NULL`, `end_time timestamptz NOT NULL`, `time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED` | `tstzrange` | Idiomatic Postgres. Plays well with `timestamptz` arithmetic. Future-proofs against the v2+ multi-timezone work — the rendering layer is the only thing that knows about `America/Cancun`. | Every read converts to local time in the API or FE. |
| **B: Local `timestamp` (no zone)** | `start_time timestamp NOT NULL`, `time_range tsrange GENERATED ALWAYS AS (tsrange(start_time, end_time, '[)')) STORED` | `tsrange` | Reads ship directly to the UI without conversion. Aligns with the Studio Profile spec's plain-`HH:MM` storage choice. | Locks v1 to the "America/Cancun forever" assumption at the schema layer; v2+ multi-timezone work needs a migration. |

**Recommendation:** **Shape A (`timestamptz` + `tstzrange`).** The architect's "extensibility hook" pattern (see ADR-0011's preamble) favors keeping storage portable; Cancun-never-DST is a rendering invariant, not a storage one. Cost is one `AT TIME ZONE 'America/Cancun'` cast in the read path, which is trivial. Studio operating hours and therapist availability remain `HH:MM` (they are weekly templates without a specific date — different beast).

* * *

## R5 — `America/Cancun` DST status — reference paragraph

### Question

Confirm `America/Cancun`'s DST status so the v2+ multi-timezone work doesn't silently inherit it.

### Reference paragraph (for inclusion in the bookings ADR)

> Quintana Roo (which includes Cancún, Tulum, and Playa del Carmen) moved permanently to **Eastern Standard Time (UTC-05)** on **1 February 2015**, leaving its previous Central time with DST behind. The IANA tz database entry `America/Cancun` reflects this: no DST transitions are scheduled. All other Mexican Caribbean / Yucatán Peninsula timezones (`America/Merida` for Yucatán, `America/Mexico_City` for the capital) **do** observe DST until 2022 when Mexico abolished DST nationwide except for the US border strip. v1 assumes `America/Cancun` exclusively and pins this assumption at the rendering layer (R3), not the storage layer (R4 recommendation). A v2+ multi-tenant deployment that adds non-Cancún studios will need: (a) per-studio `timezone` column on `studios`, (b) `Intl.DateTimeFormat({ timeZone: studio.timezone, ... })` in formatters, (c) NO schema change to `bookings` because shape A stores UTC.

### Sources

IANA tzdb entry for `America/Cancun`; Mexican Diario Oficial de la Federación decree, 1 February 2015.

* * *

## R6 — Accent-insensitive substring search for customer names

### Question

How does the F7 customer combobox §3.4 implement accent-insensitive substring match on `customers.name` (e.g. "ana" matches "Aná" and "Aña")?

### Findings

- The `unaccent` extension is available on Supabase managed Postgres (Source 3); enabled via `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;`.
- `unaccent('Aná')` returns `'Ana'`; combined with `ILIKE`, this produces case-and-accent-insensitive matching.
- For v1 scale (~200 customers/studio at the absolute upper bound), a sequential scan is acceptable. No specialized index needed.
- For v2+ scale or noticeable latency, the upgrade path is a `pg_trgm` GIN index on `unaccent(name)`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  CREATE INDEX customers_name_unaccent_trgm_idx
    ON public.customers
    USING gin (extensions.unaccent(name) extensions.gin_trgm_ops);
  ```
  Document but don't ship this index in v1.

### Recommendation

**Ship `unaccent` only.** Skip the trigram index in v1. The combobox query becomes:

```sql
SELECT id, name, phone
FROM public.customers
WHERE studio_id = $1
  AND (
    extensions.unaccent(name) ILIKE '%' || extensions.unaccent($2) || '%'
    OR phone ILIKE '%' || $2 || '%'
  )
ORDER BY name
LIMIT 10;
```

Phone search stays accent-free (phones are E.164, ASCII only).

### Concrete instructions

- Migration adds `CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;` immediately after the `btree_gist` line.
- RLS policy on `customers` is independent of `unaccent` — the policy filters by `studio_id`, the search filters by name/phone.
- Add a pgTAP test: `unaccent('María') = 'Maria'` to catch the case where the extension is missing from a fresh local-dev environment.

* * *

## Comparison matrix (decisions only)

| Topic | Decision | Cost | Reversibility |
| --- | --- | --- | --- |
| Overlap prevention (R1) | `EXCLUDE USING GIST` partial constraint | 1 migration; 1 extension | Drop constraint at any time |
| Phone validation (R2) | Reuse `libphonenumber-js` | Zero | N/A |
| Date/time formatting (R3) | `Intl.DateTimeFormat` 12-hour for both `es-MX` and `en-US`, forced `America/Cancun` | 1 shared helper module | Trivial — change formatter options |
| `btree_gist` (R4) | `CREATE EXTENSION` in bookings migration | 1 SQL line | Drop extension after dropping constraint |
| Storage shape (R4 addendum) | `timestamptz` + `tstzrange`, render to Cancun in formatters | Tiny: one `AT TIME ZONE` per read or done in formatter | Reversible by ALTER COLUMN if necessary; not expected |
| DST reference (R5) | Document in bookings ADR | Zero | N/A |
| Accent-insensitive search (R6) | `unaccent` only, sequential scan | 1 extension; one query change | Add trigram index later if needed |

* * *

## Risks and remaining unknowns

- **Supabase project pause on free-tier inactivity.** Bookings traffic from a real studio will be the loudest signal — paused project surfaces as 503 on the schedule fetch (Feature 5) and on every create/reschedule. Keep-alive workflow `(.github/workflows/keep-alive.yml)` already mitigates per project memory note. Verify keep-alive is hitting `/auth/v1/settings` and not the `/rest/v1/` root before F7 BE-1 lands.
- **Concurrent reschedule race (F8).** F8 will move a booking's `start_time`/`end_time`. The exclusion constraint catches simultaneous resched of two different bookings into the same slot. It does **not** catch the case where reschedule-A and reschedule-B target the same slot but write to two different rows — that is also caught (both attempts produce 23P01). No additional locking needed.
- **`unaccent` and IMMUTABLE.** `unaccent()` is technically `STABLE`, not `IMMUTABLE`. This is the documented gotcha for functional GIN indexes (the v2+ upgrade path above). For the sequential scan in v1, immutability doesn't matter. Architect should be aware before adding the trigram index in v2.
- **`tstzrange` `[)` half-open convention.** Postgres exclusion-constraint overlap (`&&`) honors range bounds: `[10:00, 11:00)` and `[11:00, 12:00)` do **not** overlap. F7 spec §3.2 #1 explicitly relies on this. The architect's pgTAP must include this case.
- **`btree_gist` listing in Supabase Dashboard.** The Dashboard's extension list may display the extension as "not enabled" until the migration runs; this is expected. Do not enable via Dashboard — keep it in the migration so local-dev parity holds.

* * *

## Sources

1. [Postgres Extensions Overview — Supabase Docs](https://supabase.com/docs/guides/database/extensions) — accessed 2026-05-17. Lists `btree_gist`, `unaccent`, `pg_trgm` among 50+ pre-configured extensions.
2. [PostgreSQL Documentation: F.8. btree_gist](https://www.postgresql.org/docs/17/btree-gist.html) — accessed 2026-05-17. Confirms `btree_gist` supports `uuid` and `timestamptz` operator classes; required for mixed-type exclusion constraints.
3. [Supabase community discussion: enabling `unaccent`](https://github.com/supabase/cli/issues/1706) — accessed 2026-05-17. Confirms `unaccent` availability on managed and local Supabase; documents the `extensions` schema convention.
4. IANA tz database — `America/Cancun` zone definition (post-2015-02-01: UTC-05 fixed).
5. Project: `docs/architecture/CU-869d29f1h-studio-profile.md` lines 288, 552 — establishes `libphonenumber-js` + E.164 normalization as v1 standard.
6. Project: `docs/specs/Studio Profile Setup — Spec-20260514201214.md` line 171 — establishes plain-`HH:MM` storage for studio hours (does NOT apply to bookings; bookings need absolute moments).
