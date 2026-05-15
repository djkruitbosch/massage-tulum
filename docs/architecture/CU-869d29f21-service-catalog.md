# Architecture: Service Catalog Management

**Spec:** docs/specs/Service Catalog Management — Spec-20260514201344.md
**Design:** docs/design/service-catalog.md
**Ticket:** CU-869d29f21
**ADRs created:** ADR-0010 (price snapshot for historical bookings), ADR-0011 (studio-scoped resource pattern)
**Date:** 2026-05-14
**Author:** architect (agent)

---

## 1. Summary

Service Catalog Management lets a studio owner create, edit, deactivate, and reactivate the services their studio offers. Each service record holds a name, optional description, optional category (owner-managed freetext), duration in minutes, a base price in whole MXN pesos, and an active/inactive status. The `services` table is a new studio-scoped resource following the same ownership model as `therapists` (RLS via `studio_profiles` join, no `owner_id` column on the table itself). The NestJS API gains one new module (`services/`) with five endpoints plus a sixth preflight endpoint for future-bookings count. The Next.js app gains one new page at `/studio/services` with modal-based CRUD. Analytics events are emitted server-side from NestJS. No new external service dependencies are introduced.

Historical price integrity (spec §3 "Edit service" #2) is satisfied by a denormalized `price_snapshot_mxn` column on the future `bookings` table (ADR-0010) — no structural addition to `services` is required now. The `services` table stores only the current `base_price_mxn`.

---

## 2. Data model changes

### 2a. New table: `services`

**Migration file:** `supabase/migrations/20260514000001_create_services.sql`

```sql
-- Migration: 20260514000001_create_services.sql
-- Purpose: Create the services table for the Service Catalog feature (CU-869d29f21).
--
-- Design decisions:
--   - studio_id FK to studios with ON DELETE CASCADE.
--   - name: required, 1–120 chars after trim.
--   - description: optional, max 1000 chars (spec §3 AC#7; design §5 table shows 500
--     but spec §3 AC#7 is authoritative at 1000 — the longer limit wins).
--   - category: optional, max 60 chars. Stored verbatim (case-sensitive).
--     No separate categories table; derived from DISTINCT category WHERE studio_id.
--   - duration_minutes: required, positive integer ≥ 1. No upper-bound DB constraint
--     (spec has no hard cap; design DurationPicker caps at 480 in UI only).
--   - base_price_mxn: required, integer ≥ 0. Whole pesos only (spec §9 decision 2).
--   - status: 'active' | 'inactive'. Soft-delete only; no hard DELETE API endpoint.
--   - updated_at maintained by set_updated_at() trigger (created in 20260503000005).
--   - RLS: 3 policies (SELECT, INSERT, UPDATE). No DELETE policy.
--     Ownership via studio_profiles join (ADR-0011).
--
-- Historical price integrity: handled by price_snapshot_mxn on future bookings table
--   (ADR-0010). No version table needed here.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
--   DROP TABLE IF EXISTS public.services;

CREATE TABLE public.services (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id          uuid        NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name               text        NOT NULL
                                 CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  description        text        CHECK (description IS NULL OR length(description) <= 1000),
  category           text        CHECK (category IS NULL OR length(category) <= 60),
  duration_minutes   integer     NOT NULL CHECK (duration_minutes >= 1),
  base_price_mxn     integer     NOT NULL CHECK (base_price_mxn >= 0),
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'inactive')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Composite index: list by studio + filter by status (the primary list query).
-- studio_id leading column also covers plain WHERE studio_id = $1 queries
-- (e.g., category list derivation: DISTINCT category WHERE studio_id = $1).
CREATE INDEX idx_services_studio_id_status ON public.services (studio_id, status);

-- Trigger to maintain updated_at on every row UPDATE.
-- set_updated_at() was created in migration 20260503000005.
CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (ADR-0003 Convention 1, ADR-0011) ────────────────────────────────────
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- SELECT: studio owner can read only their own studio's services.
CREATE POLICY "owner_select_services"
  ON public.services FOR SELECT TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- INSERT: studio owner can insert services only for their own studio.
CREATE POLICY "owner_insert_services"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: studio owner can update services only for their own studio.
-- Both USING and WITH CHECK required to prevent moving a row to another studio.
CREATE POLICY "owner_update_services"
  ON public.services FOR UPDATE TO authenticated
  USING (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.studio_profiles WHERE id = auth.uid()
    )
  );

-- No DELETE policy — soft delete only (status = 'inactive'). No hard DELETE via API.
```

### 2b. Indices

`idx_services_studio_id_status ON public.services (studio_id, status)` — covers:
- `WHERE studio_id = $1` (all queries; studio_id is the leading column)
- `WHERE studio_id = $1 AND status = 'active'` (active list view, default)
- `WHERE studio_id = $1 AND status = 'inactive'` (inactive list view)
- `DISTINCT category WHERE studio_id = $1` (category combobox — full index scan on studio's rows only; at ≤50 rows, no additional index needed)

### 2c. No `service_price_versions` table

Historical price integrity is deferred to the `bookings` schema. See ADR-0010. The `services` table stores only the current `base_price_mxn`. When `bookings` is created (future ticket), it must include `price_snapshot_mxn integer NOT NULL CHECK (price_snapshot_mxn >= 0)` and the NestJS booking service must copy `services.base_price_mxn` at booking creation time.

### 2d. No `categories` table

Categories are derived from `SELECT DISTINCT category FROM services WHERE studio_id = $1 AND category IS NOT NULL ORDER BY category ASC`. No separate table per spec §9 Gate 1 decision 1.

### 2e. Future-bookings count

The deactivate preflight reads `COUNT(*) FROM bookings WHERE service_id = $1 AND status IN ('confirmed', 'pending')`. The `bookings` table does not exist yet. In v1, with no bookings, this query will always return 0. The preflight endpoint is implemented to return 0 (not an error) when the bookings table does not exist — implementation note for BE-2: the service method should catch the "relation does not exist" Postgres error and return `{ futureBookingsCount: 0 }` gracefully. Alternatively, a simpler approach: the service method checks for the bookings table existence at runtime and skips the query if absent. The simplest production-ready approach is to just return 0 always until the bookings table is created; update the implementation when the bookings module is specced.

### 2f. Migration rollback plan

```sql
DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
DROP TABLE IF EXISTS public.services;
```

No downstream tables depend on `services` yet (no FK from `bookings.service_id` exists in v1).

### 2g. Seed data (dev)

Extend `supabase/seed.sql` with 3–5 sample services for the test studio (mix of active and inactive, varying categories, durations from the DurationPicker presets). This allows FE development without needing to create services first.

---

## 3. RLS policies

All four policies are specified in §2a above. Summary:

| Operation | Policy name | Rule |
|---|---|---|
| SELECT | `owner_select_services` | `studio_id IN (SELECT studio_id FROM studio_profiles WHERE id = auth.uid())` |
| INSERT | `owner_insert_services` | Same, as WITH CHECK |
| UPDATE | `owner_update_services` | Same, as both USING and WITH CHECK |
| DELETE | none | No DELETE API endpoint; hard deletes are not permitted |

Anon role: RLS enabled + no policy matching anon role = deny by default.

Cross-studio access: the RLS subquery returns only the authenticated user's `studio_id`. An UPDATE on a service belonging to another studio returns zero rows (not an error), which the NestJS service translates to `NotFoundException` (see ADR-0011 §error semantics).

---

## 4. API contract

### 4a. Module location and routing

New NestJS module: `apps/api/src/services/`. Controller route prefix: `'studios/services'`. All 6 endpoints are under `/api/studios/services`.

All endpoints require `SupabaseJwtGuard`. `studio_id` is never accepted from the request body — resolved via `StudioResolverService` (ADR-0011).

### 4b. Endpoints

#### `GET /api/studios/services`

List services for the authenticated studio.

**Query params:**
- `status`: `'active' | 'inactive' | 'all'` (optional, default `'active'`)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "studioId": "uuid",
    "name": "string",
    "description": "string | null",
    "category": "string | null",
    "durationMinutes": 60,
    "basePriceMxn": 1200,
    "status": "active",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

Ordered by `name ASC`. Empty array if no matching services.

**Error cases:** 401 (no/invalid JWT), 404 (no studio for this user).

---

#### `GET /api/studios/services/categories`

Returns the list of distinct non-null categories for the studio. Used by the CategoryCombobox on page load (lazy fetch on first focus is a FE decision; the endpoint is available for either strategy).

**Response 200:**
```json
["Relajación", "Terapéutico", "Exótico"]
```

Sorted alphabetically. Empty array if no categories have been assigned.

**Error cases:** 401, 404.

---

#### `POST /api/studios/services`

Create a new service.

**Request body (`CreateServiceDto`):**
```json
{
  "name": "string (required, 1–120 chars after trim)",
  "description": "string | null (max 1000 chars)",
  "category": "string | null (max 60 chars)",
  "durationMinutes": 60,
  "basePriceMxn": 1200
}
```

**Response 201:** `ServiceResponseDto` (same shape as list item).

**Error cases:** 401, 404, 422 (validation failure with field-level errors).

---

#### `PATCH /api/studios/services/:id`

Update any field on an existing service (active or inactive).

**Request body (`UpdateServiceDto`):** All fields optional; at least one must be provided.
```json
{
  "name": "string (1–120 chars after trim)",
  "description": "string | null (max 1000 chars)",
  "category": "string | null (max 60 chars)",
  "durationMinutes": 60,
  "basePriceMxn": 1200
}
```

**Response 200:** Updated `ServiceResponseDto`.

**Analytics:** NestJS emits `service_edited` event with `fields_changed: string[]` (array of field names that were in the request body).

**Error cases:** 400 (no fields provided), 401, 404 (service not found or not owned), 422 (validation failure).

---

#### `GET /api/studios/services/:id/future-bookings-count`

Preflight for the deactivation confirmation dialog. Returns the count of future bookings (status `confirmed` or `pending`) for the service. This is a separate GET endpoint (not embedded in a "preview" deactivate call) so the FE can fetch it at dialog-open time without committing to the deactivation.

**Response 200:**
```json
{ "futureBookingsCount": 0 }
```

Returns `0` always in v1 (bookings table does not exist yet). When the bookings module is implemented, this endpoint's service method is updated to run the actual count query. No API contract change is needed at that time — the shape is stable.

**Error cases:** 401, 404 (service not found or not owned).

---

#### `POST /api/studios/services/:id/deactivate`

Flip service status to `inactive`.

**Request body:** None.

**Response 200:** Updated `ServiceResponseDto` (status = `'inactive'`).

**Response 409:** `{ "error": "service_already_inactive" }` when status is already `inactive`.

**Analytics:** NestJS emits `service_deactivated` with `had_future_bookings: bool` and `future_booking_count: int`. In v1 both are always `false` / `0` since bookings don't exist yet. The service method resolves the count from the same logic as the preflight endpoint.

**Error cases:** 401, 404, 409.

---

#### `POST /api/studios/services/:id/reactivate`

Flip service status to `active`.

**Request body:** None.

**Response 200:** Updated `ServiceResponseDto` (status = `'active'`).

**Response 409:** `{ "error": "service_already_active" }` when status is already `active`.

**Analytics:** NestJS emits `service_reactivated` with `studio_id` and `service_id`.

**Error cases:** 401, 404, 409.

---

### 4c. DTO validation rules (`CreateServiceDto` / `UpdateServiceDto`)

| Field | Rule |
|---|---|
| `name` | `@IsString() @IsNotEmpty() @MaxLength(120)` — trimmed before save |
| `description` | `@IsString() @IsOptional() @MaxLength(1000)` — null/undefined = store null |
| `category` | `@IsString() @IsOptional() @MaxLength(60)` — null/undefined = store null |
| `durationMinutes` | `@IsInt() @Min(1)` — must be a positive integer |
| `basePriceMxn` | `@IsInt() @Min(0)` — 0 is valid (free service) |

Invalid requests return **422 Unprocessable Entity** (not 400) to match NestJS `ValidationPipe` with `transform: true`. The global exception filter formats the response as `{ statusCode: 422, message: string[], error: 'Unprocessable Entity' }`.

`UpdateServiceDto` uses `@IsOptional()` on every field but adds a class-level validator that at least one field is provided (throw `BadRequestException` in the service method if `Object.keys(dto).filter(k => dto[k] !== undefined).length === 0`).

### 4d. Zod schemas (`packages/shared`)

New file: `packages/shared/src/schemas/service.schema.ts`

Exports:
- `serviceResponseSchema` — for FE to parse/validate API responses.
- `createServiceSchema` — base validation schema; used by react-hook-form + zod on FE and as the basis for NestJS DTO decorators.
- `updateServiceSchema` — partial of `createServiceSchema`.

### 4e. 409 error contract

Both deactivate and reactivate return `409 Conflict` for idempotent-but-wrong-state calls. The NestJS service checks the current status before updating and throws `ConflictException` with the appropriate message string (`'service_already_inactive'` or `'service_already_active'`). The global exception filter passes this through as `{ "error": "service_already_inactive" }`.

---

## 5. Analytics

All events are emitted server-side from NestJS after the DB write succeeds. In v1, analytics are logged (Logger output) because no analytics sink (Mixpanel, Segment, etc.) has been provisioned. The service method calls a shared `AnalyticsService.track(event, properties)` stub — the stub logs to NestJS Logger. This keeps the call site clean for when a real analytics sink is wired.

| Event | Properties | Emitted from |
|---|---|---|
| `service_created` | `studio_id`, `service_id`, `duration_minutes`, `base_price_mxn`, `has_category: bool`, `has_description: bool` | `createService` after successful INSERT |
| `service_edited` | `studio_id`, `service_id`, `fields_changed: string[]` | `updateService` after successful UPDATE |
| `service_deactivated` | `studio_id`, `service_id`, `had_future_bookings: bool`, `future_booking_count: int` | `deactivateService` after successful UPDATE |
| `service_reactivated` | `studio_id`, `service_id` | `reactivateService` after successful UPDATE |
| `service_catalog_viewed` | `studio_id`, `active_count: int`, `inactive_count: int`, `filter_applied: 'all'|'active'|'inactive'` | `listServices` — counts resolved from the full unfiltered list |

`service_catalog_viewed`: the list endpoint fetches `status = 'all'` and counts active/inactive before applying the requested filter for the response. This ensures the analytics event always carries complete counts regardless of the filter parameter. This is one extra in-memory pass over the result set — acceptable at ≤50 services.

**PII policy:** Service name, description, and category are never logged. Log only `serviceId` and `studioId` (UUIDs) for correlation.

---

## 6. Sequence diagram — deactivate with preflight

```mermaid
sequenceDiagram
  actor Owner as Studio Owner
  participant Browser as Browser (Client Component)
  participant SA as Server Action (services.ts)
  participant BE as NestJS /api/studios/services
  participant DB as Supabase Postgres (RLS)

  Owner->>Browser: Clicks Deactivate on service row
  Browser->>SA: getFutureBookingsCount(serviceId)
  SA->>BE: GET /api/studios/services/:id/future-bookings-count (Bearer JWT)
  BE->>BE: SupabaseJwtGuard — verify JWT, extract userId
  BE->>BE: resolveStudioId(userId) via StudioResolverService
  BE->>DB: SELECT COUNT(*) FROM bookings WHERE service_id=$1 AND status IN ('confirmed','pending')
  Note over DB: Returns 0 in v1 (no bookings table yet — service returns 0 gracefully)
  DB-->>BE: { count: 0 }
  BE-->>SA: 200 { futureBookingsCount: 0 }
  SA-->>Browser: futureBookingsCount = 0

  Browser->>Browser: Open ConfirmationDialog
  Note over Browser: futureBookingsCount = 0 → no warning block shown

  Owner->>Browser: Confirms deactivation
  Browser->>SA: deactivateService(serviceId)
  SA->>BE: POST /api/studios/services/:id/deactivate (Bearer JWT)
  BE->>BE: SupabaseJwtGuard — verify JWT, extract userId
  BE->>BE: resolveStudioId(userId)
  BE->>DB: SELECT status FROM services WHERE id=$1 AND studio_id=$2
  alt status is already 'inactive'
    BE-->>SA: 409 { error: "service_already_inactive" }
    SA-->>Browser: Error
    Browser-->>Owner: Toast error (should not happen via UI — defensive)
  end
  BE->>DB: UPDATE services SET status='inactive' WHERE id=$1 AND studio_id=$2
  BE->>BE: Emit service_deactivated analytics event
  DB-->>BE: Updated row
  BE-->>SA: 200 ServiceResponseDto (status='inactive')
  SA-->>Browser: Updated service
  Browser-->>Owner: Dialog closes; Toast "Service deactivated"; row removed from Active list
```

---

## 7. Out of scope for this ticket

Per spec §4:
- Per-therapist pricing surcharges, peak/seasonal pricing, discount/promo engine.
- Service photos / rich media.
- Public / customer-facing service listing (v2).
- Service-to-therapist capability mapping (separate ticket CU-869d29f2z).
- Drag-to-reorder display ordering (v2).
- Service variants as sub-rows.
- Bulk CSV import (v2).
- "Archived" vs. "deactivated" distinction.
- Hard cap on services per studio.
- Categories as a first-class entity.

**v2 Stripe seam:** `base_price_mxn` is stored as whole pesos (integer). At v2, the payment-intent creation code multiplies by 100 to get centavos. ADR-0010 flags this. The `services` schema is stable; no migration is needed for the Stripe integration.

---

## 8. Performance and scale notes

Expected load: 1–10 studio owners, each managing ≤50 services. No pagination required. All list queries are O(n) on the studio's service rows, bounded at ~50.

`idx_services_studio_id_status` covers the common access patterns. The category list derivation (`SELECT DISTINCT category WHERE studio_id = $1 AND category IS NOT NULL`) performs a partial index scan on the leading `studio_id` column — fast at ≤50 rows.

The `updated_at` trigger fires on every UPDATE. Negligible overhead at this scale.

No caching needed in v1.

---

## 9. Security notes

**Authorization model:**
- Page is protected: Next.js middleware redirects unauthenticated users to `/login`.
- API is protected: `SupabaseJwtGuard` verifies the JWT on every request.
- Data access: RLS on `services` (3 policies, §3) restricts access to the owner's own studio. A cross-studio UPDATE returns zero rows; NestJS service translates this to 404 (ADR-0011 §error semantics).
- `studio_id` is never accepted from the request body — always server-derived from the JWT via `StudioResolverService`.

**Data validation points:**
- FE: react-hook-form + zod schema from `packages/shared` (client-side, immediate feedback).
- NestJS DTO: class-validator decorators (server-side, authoritative). Validation errors return 422.
- DB: CHECK constraints (`length(name) > 0`, `duration_minutes >= 1`, `base_price_mxn >= 0`, `status IN ('active', 'inactive')`).
- `name` trimmed server-side before save.

**409 conflict errors:** These are expected operational errors (double-click on deactivate button, direct API call). The FE is designed so the UI prevents reaching this state; the 409 is a safety net. The analytics health metric "zero 409 `service_already_inactive` attempts traceable to UI" confirms this.

**Rate limiting:** No new rate limits. The endpoints are authenticated; the existing `@nestjs/throttler` global applies a baseline.

**PII handling:** Service name, description, and category are business data — no stricter PII treatment than studio profile data. Log only service/studio UUIDs for correlation. Never echo service name in error messages.

**Concurrent edits:** Last-write-wins (spec §5). One owner per studio in v1. No optimistic locking. Note for future multi-user consideration: an `updated_at` comparison at PATCH time could detect conflicts — not implemented now.

---

## 10. Frontend impact

### 10a. New route

`/studio/services` (locale-prefixed: `/es/studio/services`, `/en/studio/services`). Protected by existing middleware — unauthenticated users redirect to `/login?next=/studio/services`.

### 10b. New files

```
apps/web/
  app/
    [locale]/
      studio/
        services/
          page.tsx                              NEW — Server Component; fetches services via server action
          _components/
            service-list.tsx                   NEW — "use client"; list + filter bar + row rendering
            service-row.tsx                    NEW — "use client"; single row with action buttons
            service-form-modal.tsx             NEW — "use client"; create/edit modal (react-hook-form)
            deactivate-confirm-modal.tsx       NEW — "use client"; confirmation dialog with preflight
            reactivate-confirm-modal.tsx       NEW — "use client"; confirmation dialog
            category-combobox.tsx              NEW — "use client"; prefix-match + free-text entry
            duration-picker.tsx                NEW — "use client"; preset chips + custom escape hatch
            filter-bar.tsx                     NEW — "use client"; Active/Deactivated/All segment
            status-pill.tsx                    NEW — server-renderable; Active/Deactivated badge
  actions/
    services.ts                                NEW — all server actions for services CRUD
  messages/
    es.json                                    MODIFY — add serviceCatalog.* keys
    en.json                                    MODIFY — add serviceCatalog.* keys
```

### 10c. Server actions (`apps/web/actions/services.ts`)

- `listServices(status)` — GET /api/studios/services?status=...
- `getCategories()` — GET /api/studios/services/categories
- `createService(dto)` — POST /api/studios/services
- `updateService(id, dto)` — PATCH /api/studios/services/:id
- `getFutureBookingsCount(id)` — GET /api/studios/services/:id/future-bookings-count
- `deactivateService(id)` — POST /api/studios/services/:id/deactivate
- `reactivateService(id)` — POST /api/studios/services/:id/reactivate

### 10d. MXN currency formatting

Per spec §5 and design §3.4: render via `Intl.NumberFormat` with `{ style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }`. This produces `$1,200` in `es-MX` locale and `MX$1,200` in `en-US` locale — sufficient disambiguation for English-speaking tourists who would interpret `$` as USD without the `MX` prefix. Use `currencyDisplay: 'symbol'` (the default, not `'narrowSymbol'`) for maximum browser compatibility (Safari < 14.1 does not support `'narrowSymbol'`).

Concretely, in the FE component: `new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(basePriceMxn)`.

### 10e. Duration display

Display logic (display-only, not stored): if `durationMinutes % 60 === 0`, show `{h} hr` (omit zero minutes); otherwise show `{n} min`. Exception: if `durationMinutes >= 60`, show `{h} hr {m} min` only when `m !== 0`. This resolves design §15 open question 2 — omit zero minutes. Examples: 60 → "1 hr", 90 → "1 hr 30 min", 45 → "45 min". Implemented as a utility function in the FE component, not as a translation key.

### 10f. i18n keys

All keys from design §10 "Copy Keys" table plus the `services.*` namespace from spec §8. Both `es.json` and `en.json` must be fully populated at the same time — no partial keys shipped (CLAUDE.md convention). The FE-1 ticket lists all keys explicitly.

### 10g. Category combobox — API strategy

Categories fetched lazily on first focus of the combobox (not on page load). The `getCategories()` server action is called once and cached in local component state for the duration of the page session. If the owner creates a new category during the session, it is added to the local list after a successful save (optimistic client update). This resolves design §15 open question 3 — lazy fetch preferred.

### 10h. Sort order

Active list and all-services list are ordered by `name ASC` (alphabetical). This is not configurable in v1. Resolves design §15 open question 4 — alphabetical by name.

### 10i. Navigation

Add `/studio/services` link to the studio dashboard nav. Mirror the pattern of the `/studio/therapists` link (the most recent FE nav addition).

---

## 11. Integrations

- **Supabase Postgres** — new `services` table + 3 RLS policies + index + `updated_at` trigger (reuses existing `set_updated_at()` function).
- **Supabase Auth** — existing session. `SupabaseJwtGuard` (already implemented) covers all new endpoints.
- **NestJS API** — new `services/` module imported into `AppModule`.
- **No new external services.** No Brevo, no WhatsApp, no Stripe, no Storage bucket.

---

## 12. Open questions

None blocking implementation. All spec §10 research items resolved:

1. **Price snapshot mechanism:** Denormalized column on future `bookings` table (ADR-0010). `services` schema unaffected.
2. **MXN currency formatting:** `Intl.NumberFormat` with `style: 'currency', currency: 'MXN', minimumFractionDigits: 0, currencyDisplay: 'symbol'`. `es-MX` → `$1,200`. `en-US` → `MX$1,200`. `'symbol'` (not `'narrowSymbol'`) for Safari < 14.1 compat. Documented in §10d above.

---

## 13. Ticket breakdown

### BE-1 — Migration + RLS + pgTAP

**Title:** [BE] Service Catalog: `services` table migration, RLS policies, pgTAP tests, seed data

**Agent:** `developer-be`

**Depends on:** Nothing (no app code touched).

**Files to create:**
- `supabase/migrations/20260514000001_create_services.sql` — full DDL from §2a above, verbatim. Do not alter; if there is a conflict with an existing migration timestamp, use the next available date prefix.
- `supabase/tests/rls_services_test.sql` — pgTAP test file (see required cases below).

**Files to modify:**
- `supabase/seed.sql` — add 5 sample services for the test studio: 2 active with category, 1 active without category, 1 inactive with category, 1 active with `base_price_mxn = 0`. Use UUIDs consistent with the existing seed studio. Duration values should use DurationPicker presets (30, 60, 90, 120 minutes).

**Required pgTAP test cases (`supabase/tests/rls_services_test.sql`):**

Follow the ADR-0003 Convention 3 canonical template with the `studio_profiles`-based ownership model (not a direct `owner_id` column — mirror `rls_therapists_test.sql` exactly).

```sql
BEGIN;
SELECT plan(7);

-- Arrange (service_role context):
-- Insert test studios + studio_profiles + services for two distinct owners.
-- owner_a owns studio_a and its services; owner_b owns studio_b and its services.

-- Case 1: anon cannot SELECT
SET LOCAL role = anon;
SELECT is_empty($$ SELECT * FROM public.services $$, 'anon: cannot select services');

-- Case 2: owner_a can SELECT their own services
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "owner_a_uuid", "role": "authenticated"}';
SELECT ok(
  (SELECT count(*) FROM public.services WHERE studio_id = 'studio_a_uuid') > 0,
  'owner_a: can select own services'
);

-- Case 3: owner_a cannot SELECT owner_b services
SELECT is_empty(
  $$ SELECT * FROM public.services WHERE studio_id = 'studio_b_uuid' $$,
  'owner_a: cannot select cross-studio services'
);

-- Case 4: anon cannot INSERT
SET LOCAL role = anon;
SELECT throws_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('studio_a_uuid', 'Test', 60, 100) $$,
  'new row violates row-level security policy for table "services"',
  'anon: cannot insert services'
);

-- Case 5: owner_a can INSERT for own studio
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "owner_a_uuid", "role": "authenticated"}';
SELECT lives_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('studio_a_uuid', 'Permitted Insert', 60, 100) $$,
  'owner_a: can insert service for own studio'
);

-- Case 6: owner_a cannot INSERT for owner_b studio
SELECT throws_ok(
  $$ INSERT INTO public.services (studio_id, name, duration_minutes, base_price_mxn)
     VALUES ('studio_b_uuid', 'Cross-Studio Insert', 60, 100) $$,
  'new row violates row-level security policy for table "services"',
  'owner_a: cannot insert service for cross-studio'
);

-- Case 7: owner_a cannot UPDATE owner_b services
SELECT is(
  (WITH upd AS (
    UPDATE public.services SET name = 'Hacked'
    WHERE studio_id = 'studio_b_uuid'
    RETURNING id
  ) SELECT count(*)::int FROM upd),
  0,
  'owner_a: cannot update cross-studio services'
);

SELECT * FROM finish();
ROLLBACK;
```

**Definition of done:**
- Migration applies cleanly on a fresh `supabase db reset`.
- `supabase test db` passes all 7 pgTAP cases.
- `rls_baseline_test.sql` still passes (zero tables without RLS).
- No app code touched.
- `supabase/seed.sql` seeds 5 sample services without errors.

---

### BE-2 — NestJS module + endpoints + DTOs + analytics

**Title:** [BE] Service Catalog: NestJS `services` module, 6 endpoints, DTOs, analytics stub

**Agent:** `developer-be`

**Depends on:** BE-1 (migration must be applied for integration; unit tests can proceed in parallel since they mock the DB client).

**Files to create:**
- `apps/api/src/services/services.module.ts` — imports `StudioResolverModule`; exports nothing.
- `apps/api/src/services/services.controller.ts` — all 6 endpoints decorated per §4; route prefix `'studios/services'`; `@UseGuards(SupabaseJwtGuard)` at class level.
- `apps/api/src/services/services.service.ts` — all service methods; injects `StudioResolverService`; uses `buildUserClient(jwt)` pattern (copy from `TherapistsService`); emits analytics via Logger stub.
- `apps/api/src/services/dto/create-service.dto.ts` — class-validator decorators per §4c.
- `apps/api/src/services/dto/update-service.dto.ts` — all fields optional (`@IsOptional()`); same validators as create.
- `apps/api/src/services/dto/service-response.dto.ts` — Swagger `@ApiProperty` decorators on all fields.
- `apps/api/src/services/__tests__/services.service.spec.ts` — unit tests (mock `StudioResolverService` and Supabase client).
- `packages/shared/src/schemas/service.schema.ts` — zod schemas (`createServiceSchema`, `updateServiceSchema`, `serviceResponseSchema`).

**Files to modify:**
- `apps/api/src/app.module.ts` — import and add `ServicesModule` to `imports[]`.
- `packages/shared/src/index.ts` — export new service schemas.

**Swagger requirements (all endpoints):**
- `@ApiTags('services')`
- `@ApiBearerAuth()`
- `@ApiOperation({ summary, description })`
- `@ApiOkResponse` / `@ApiCreatedResponse` with `type: ServiceResponseDto` (or array)
- `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiNotFoundResponse`
- `@ApiConflictResponse` on deactivate and reactivate (409)
- `@ApiQuery` on the list endpoint for the `status` filter

**Unit test requirements:**
- `listServices` — returns mapped DTOs; applies status filter; emits `service_catalog_viewed`.
- `createService` — inserts and returns DTO; emits `service_created`.
- `updateService` — partial update; `fields_changed` populated correctly; 400 if no fields; emits `service_edited`.
- `getFutureBookingsCount` — returns `{ futureBookingsCount: 0 }` (no bookings table in v1).
- `deactivateService` — returns updated DTO; throws `ConflictException` if already inactive; emits `service_deactivated`.
- `reactivateService` — returns updated DTO; throws `ConflictException` if already active; emits `service_reactivated`.
- Cross-studio case: when `studioResolver.resolveStudioId` returns studioA, an update targeting a service belonging to studioB returns zero rows from the user-scoped client → service throws `NotFoundException`.

**Definition of done:**
- All 6 endpoints visible in Swagger at `http://localhost:3001/api/docs`.
- `pnpm --filter @massage-tulum/api test` passes (unit tests green).
- `pnpm --filter @massage-tulum/api typecheck` passes (zero TS errors).
- No use of service-role key in the services module (all DB writes use `buildUserClient(jwt)` with the anon key + JWT; only `StudioResolverService` uses service-role, and it's an imported dependency).

---

### FE-1 — `/studio/services` page + modals + i18n

**Title:** [FE] Service Catalog: `/studio/services` page, CRUD modals, DurationPicker, CategoryCombobox, i18n

**Agent:** `developer-fe`

**Depends on:** BE-2 (API must exist for integration testing; FE development against local NestJS is unblocked immediately — the API contract is fully specified above).

**Files to create:**

```
apps/web/
  app/[locale]/studio/services/
    page.tsx                              Server Component; calls listServices('active') on load;
                                          renders ServiceList or loading/error state.
    _components/
      service-list.tsx                   "use client"; receives initial data from page.tsx as prop;
                                          manages filter state; handles optimistic list updates after CRUD.
      service-row.tsx                    "use client"; renders one service row per design §4;
                                          desktop and mobile layouts (flex-col at <768px).
      service-form-modal.tsx             "use client"; create + edit modes; react-hook-form +
                                          createServiceSchema / updateServiceSchema from packages/shared;
                                          DurationPicker and CategoryCombobox as sub-components.
      deactivate-confirm-modal.tsx       "use client"; fires getFutureBookingsCount on open;
                                          shows warning block conditionally if count > 0;
                                          confirm triggers deactivateService server action.
      reactivate-confirm-modal.tsx       "use client"; simple confirmation dialog; triggers
                                          reactivateService server action.
      duration-picker.tsx                "use client"; preset chip group (30,45,60,75,90,105,120,150,180)
                                          + "Custom..." chip with inline input; aria-pressed chips;
                                          exposes value as integer minutes.
      category-combobox.tsx              "use client"; controlled text input; fetches categories lazily
                                          on first focus via getCategories(); prefix-match dropdown;
                                          "Create '...'" option; keyboard nav per design §8.
      filter-bar.tsx                     "use client"; Active/Deactivated/All segment control;
                                          calls listServices(status) on selection change.
      status-pill.tsx                    Server-renderable; accepts status prop; renders badge per
                                          design tokens (success for active, neutral for inactive).
  actions/services.ts                   All 7 server actions listed in §10c above.
```

**i18n keys to add** — both `es.json` and `en.json` must be populated simultaneously. Add the following namespaces (verbatim values from design §10 and spec §8):

*All `serviceCatalog.*` keys from design §10:* page.title, page.subtitle, action.addService, action.edit, action.deactivate, action.deactivateConfirm, action.reactivate, action.reactivateConfirm, modal.add.title, modal.edit.title, field.name.label, field.name.error.required, field.category.label, field.category.helper, field.category.createOption, field.category.noOptions, field.description.label, field.duration.label, field.duration.unit, field.duration.error.required, field.duration.error.min, field.duration.error.max, field.duration.custom, field.duration.customLabel, field.price.label, field.price.helper, field.price.error.required, field.price.error.min, duration.format, duration.formatHours, deactivate.title, deactivate.body, deactivate.hasBookings, reactivate.title, reactivate.body, filter.active, filter.inactive, filter.all, list.label, status.active, status.inactive, loading, empty.active.title, empty.active.body, empty.deactivated.title, empty.deactivated.body, loadError.title, loadError.body.

*All `services.*` keys from spec §8:* form.* and toast.* namespaces (the spec and design use slightly different key hierarchies; the design §10 keys are authoritative for the FE; use `serviceCatalog.*`).

**MXN formatting:** implement the `formatMxnPrice(amount: number, locale: string): string` utility in `apps/web/lib/format.ts` using `Intl.NumberFormat` per §10d above. Use this utility in `service-row.tsx` and `service-form-modal.tsx`.

**Duration formatting:** implement `formatDurationMinutes(minutes: number): string` utility in `apps/web/lib/format.ts` per §10e above. Use in `service-row.tsx`.

**Files to modify:**
- `apps/web/messages/es.json` — add all `serviceCatalog.*` keys (Spanish values from design §10).
- `apps/web/messages/en.json` — add all `serviceCatalog.*` keys (English values from design §10).
- `apps/web/app/[locale]/studio/dashboard/page.tsx` (or nav component) — add `/studio/services` link, mirroring the therapist roster link.

**Definition of done:**
- Page renders at `/studio/services` and `/en/studio/services`; auth-protected (redirect to `/login` for unauthenticated users).
- Loading skeleton (5 rows) visible during initial fetch.
- Empty state shown for all three filter cases (active, deactivated, all).
- Create modal: all fields; validation fires before API call; success closes modal + adds row to list + toast; error keeps modal open + shows inline errors.
- Edit modal: pre-filled from service data; all fields editable; same success/error behavior.
- DurationPicker: all 9 presets selectable; "Custom..." activates inline input; on Edit, preset pre-selected if stored value matches; "Custom..." pre-selected if not in preset list.
- CategoryCombobox: fetches existing categories lazily on first focus; prefix-match filter; "Create '...'" option for new values; free-text accepted on blur.
- Deactivate: preflight count fetched on dialog open; warning block shown if count > 0; confirm triggers deactivate; row removed from Active view; toast shown.
- Reactivate: simple confirmation; row removed from Deactivated view; toast shown.
- Filter bar: Active / Deactivated / All; default is Active.
- Both `es.json` and `en.json` fully populated with all `serviceCatalog.*` keys — no missing translation keys.
- `pnpm --filter @massage-tulum/web typecheck` passes.
- `pnpm --filter @massage-tulum/web lint` passes.
- Mobile layout (375px): service-row stacks name/category, duration/price, actions vertically; modal is full-width inset; DurationPicker chips wrap naturally.
- WCAG 2.1 AA: action buttons have `aria-label` with service name; DurationPicker chips are `<button aria-pressed>`; CategoryCombobox uses `role="combobox"` with `aria-expanded` and `aria-controls`; modal has `role="dialog"` with `aria-labelledby`; focus returns to trigger on modal close.
