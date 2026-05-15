# Service Catalog Management — Spec

# Spec — Service Catalog Management

**Ticket:** [CU-869d29f21](https://app.clickup.com/t/869d29f21)
**Status:** Spec (awaiting Gate 1 approval)
**Author:** product-manager (agent)
**Date:** 2026-05-03
**Roadmap reference:** v1 Roadmap, "Studio Setup" cluster, P0
* * *

## 1\. Problem

A Tulum studio owner has no centralized place to define the services they sell. Today, prices and offerings live in WhatsApp messages, Instagram bios, and paper menus — making every price change a multi-place manual update with errors and inconsistency.

This feature is foundational: every downstream v1 feature (booking, scheduling, availability) references a service record. Studios typically offer 5–20 named service types (relaxation, deep tissue, Thai, lomi-lomi, 4-hands, etc.), each with a fixed duration and a peso price. Owners manage the catalog regularly — adding new services, updating prices, retiring seasonal offerings.
* * *

## 2\. User stories

1. As a studio owner, I want to create a service with a name, optional description, duration, and base price, so I have a single source of truth for what I sell.
2. As a studio owner, I want to assign a category to a service (using categories I previously typed, or by adding a new one inline), so I can group related services.
3. As a studio owner, I want to edit any field on an existing service.
4. As a studio owner, I want to deactivate a service I no longer offer, so it stops appearing in new booking flows while my historical records stay intact.
5. As a studio owner, I want to reactivate a previously deactivated service, so I can bring back seasonal offerings.
6. As a studio owner, I want to see all my services — active and deactivated — in a filterable list, so I can manage my full catalog at a glance.
7. As a studio owner, I want each row to show name, category, duration, current price, and status inline, so I can spot inconsistencies without opening every record.
* * *

## 3\. Acceptance criteria

**Create service**

1. Given an authenticated owner on the catalog page, when they submit a valid create-service form, then a new service record is created scoped to their studio and appears immediately in the active list without a full-page reload.
2. Required fields: `name` (1–120 chars), `duration_minutes` (positive integer ≥ 1), `base_price_mxn` (integer ≥ 0). Optional: `description` (0–1000 chars), `category` (0–60 chars).
3. Submitting with empty `name` → `services.form.errors.nameRequired`, no API call.
4. `duration_minutes` not a positive integer (zero, negative, decimal, non-numeric) → `services.form.errors.durationInvalid`.
5. `base_price_mxn` < 0 → `services.form.errors.priceNegative`.
6. `base_price_mxn` = 0 is valid (free / complimentary service).
7. `name` > 120 chars → `services.form.errors.nameTooLong`. `description` > 1000 chars → `services.form.errors.descriptionTooLong`. `category` > 60 chars → `services.form.errors.categoryTooLong`.
8. Backend NestJS DTO must enforce all of #2–#7; a direct API call with invalid data returns 422 identifying the failing field.

**Categories — owner-managed list**

1. The category field uses a combobox: typing surfaces the owner's previously-used categories (case-insensitive prefix match) for selection. The owner may also type a new value — this creates the new category implicitly when the service is saved.
2. The set of categories is derived from `DISTINCT services.category WHERE services.studio_id = current_studio AND category IS NOT NULL`. There is no separate `categories` table in v1.
3. Renaming a category is achieved by editing each affected service's category value (no bulk rename in v1).
4. An empty category is valid (the service is uncategorized).

**Edit service**

1. Given an existing service (active or inactive), when the owner edits any field and saves, then the updated values are persisted and reflected in the list within the same page session, with success toast `services.toast.updated`.
2. **Historical price integrity:** when `base_price_mxn` is edited, any past booking record continues to display the price in effect at booking time. The mechanism (denormalized snapshot on the booking row, vs. price-version table, vs. another approach) is the architect's decision; the product requirement is unambiguous. _Architect must select an approach in their ADR._
3. Validation rules from #2–#7 apply identically on edit.

**Deactivate**

1. Given an active service, when the owner triggers deactivate, then a confirmation dialog shows `services.deactivate.confirmTitle` + `services.deactivate.confirmBody`. If the API has detected future bookings (status `confirmed` OR `pending`) for the service, the dialog also shows the count via `services.deactivate.confirmBodyWithBookings` (interpolating `{count}`).
2. The future-booking count is fetched at the moment the dialog opens, not cached from page load. (API may either expose a pre-flight endpoint or include the count in the deactivate response with a "preview" flag — architect's choice.)
3. On confirm: status flips to `inactive`, service removed from `active`\-filtered view, success toast `services.toast.deactivated`. On cancel: no change.
4. Deactivating an already-inactive service via direct API → 409 `{ "error": "service_already_inactive" }`.

**Reactivate**

1. Given a deactivated service, when the owner triggers reactivate (no confirmation dialog), then status flips to `active`, success toast `services.toast.reactivated`.
2. Reactivating an already-active service via direct API → 409 `{ "error": "service_already_active" }`.

**List view**

1. Given the catalog page, all services for the owner's studio load and each row displays: name, category, duration (in minutes), base price (formatted MXN whole-peso), status badge.
2. The view supports a filter: `active` / `inactive` / `all`. Default is `active`.
3. Empty state (zero services): `services.catalog.emptyState` with a CTA opening the create form.
4. **Soft target:** the UI is designed assuming ≤50 services per studio. No pagination required in v1, but layout (table or list) must remain usable at 50 rows.

**Authorization**

1. Any request to a service endpoint for a studio the authenticated user does not own → 403. Enforced at Supabase RLS, not solely in app code.
2. Unauthenticated request → 401.
* * *

## 4\. Out of scope

*   Per-therapist pricing surcharges, peak/seasonal pricing, discount/promo engine, package/multi-session pricing, membership pricing — all v2+.
*   Service photos / rich media (no customer-facing display in v1).
*   Public / customer-facing service listing (v2 — customer booking flow).
*   Service-to-therapist capability mapping (which therapists deliver which service) — separate ticket, likely under availability (CU-869d29f2z).
*   Drag-to-reorder display ordering (v2).
*   Service variants as sub-rows of one record (each duration is its own service in v1).
*   Bulk CSV import (v2).
*   Distinction between "archived" and "deactivated" (single `inactive` state).
*   Hard cap on services per studio (no enforced limit; UI designed for ≤50).
*   Categories as a first-class entity (no separate `categories` table; categories are derived from service rows).
* * *

## 5\. Edge cases and error states

*   **Optional fields empty:** description, category — both empty and null valid; render service card without layout breakage; never show literal "null".
*   **Network failure on save:** form retains owner input; `toast.error.network`; retryable.
*   **Concurrent edits:** v1 has one owner per studio. Last-write-wins acceptable; no optimistic locking in v1 (architect should note for future multi-user).
*   **Deactivate with future bookings:** behavior in #16–#17 is not blocking — owner can proceed despite the warning. Cancellation of those bookings is owned by the booking module, not this spec.
*   **Locale formatting:** `base_price_mxn` stored as integer pesos (locale-independent). Frontend renders via `Intl.NumberFormat`: `es` → `$1,200 MXN`, `en` → `MX$1,200`. Researcher to confirm exact `currencyDisplay` opts (see §10).
*   **Duration display:** `{n} min` in both locales (verified locale-independent).
*   **Categories case sensitivity:** combobox prefix-matches case-insensitively but stores the value verbatim (so owner can choose canonical capitalization).
* * *

## 6\. Analytics and success metrics

| Event | Properties | When fired |
| ---| ---| --- |
| `service_created` | `studio_id`, `service_id`, `duration_minutes`, `base_price_mxn`, `has_category: bool`, `has_description: bool` | After successful create |
| `service_edited` | `studio_id`, `service_id`, `fields_changed: string[]` | After successful edit |
| `service_deactivated` | `studio_id`, `service_id`, `had_future_bookings: bool`, `future_booking_count: int` | After confirmed deactivation |
| `service_reactivated` | `studio_id`, `service_id` | After reactivation |
| `service_catalog_viewed` | `studio_id`, `active_count: int`, `inactive_count: int`, `filter_applied: 'all' | 'active' | 'inactive'` | On page load and on filter change |

All events server-side (NestJS).

**Success metrics**

*   Primary: ≥90% of onboarded owners create at least one active service within 24h of account creation.
*   Secondary: median services-per-studio after 7 days (no baseline; track to establish).
*   Health check: zero 409 `service_already_inactive` attempts traceable to UI (confirms users can't reach a broken delete path).
* * *

## 7\. Roles and permissions

*   **Studio owner only.** Full CRUD on services in their studio.
*   **Therapist:** no write access in v1. Read access is a v2+ concern (architect should note as extensibility hook in the ADR — do not implement now).
*   **Customer:** no access in v1.

**RLS pattern (mirrors auth + profile + roster):**

```sql
auth.uid() = (SELECT owner_id FROM studios WHERE id = services.studio_id)
```

Apply to SELECT/INSERT/UPDATE/DELETE on `services` and to any derived tables (e.g., a price-version table if used).
* * *

## 8\. Localization

New keys under the `services.*` namespace (es is canonical; en is the parallel translation).

**`services.catalog.*`**

```python
title                       es: "Catálogo de servicios"        en: "Service catalog"
emptyState                  es: "Aún no tienes servicios. Crea tu primero."  en: "You don't have any services yet. Create your first one."
createButton                es: "Nuevo servicio"               en: "New service"
filter.all                  es: "Todos"                        en: "All"
filter.active               es: "Activos"                      en: "Active"
filter.inactive             es: "Inactivos"                    en: "Inactive"
columns.name                es: "Nombre"                       en: "Name"
columns.category            es: "Categoría"                    en: "Category"
columns.duration            es: "Duración"                     en: "Duration"
columns.price               es: "Precio base"                  en: "Base price"
columns.status              es: "Estado"                       en: "Status"
```

**`services.status.*`**

```bash
active                      es: "Activo"                       en: "Active"
inactive                    es: "Inactivo"                     en: "Inactive"
```

**`services.form.*`**

```bash
title.create                es: "Nuevo servicio"               en: "New service"
title.edit                  es: "Editar servicio"              en: "Edit service"
fields.name.label           es: "Nombre del servicio"          en: "Service name"
fields.name.placeholder     es: "Ej. Masaje de relajación"     en: "E.g. Relaxation massage"
fields.description.label    es: "Descripción"                  en: "Description"
fields.description.placeholder  es: "Describe el servicio brevemente (opcional)"  en: "Briefly describe the service (optional)"
fields.durationMinutes.label    es: "Duración (minutos)"       en: "Duration (minutes)"
fields.basePriceMxn.label       es: "Precio base (MXN, pesos enteros)"  en: "Base price (MXN, whole pesos)"
fields.category.label           es: "Categoría"                en: "Category"
fields.category.placeholder     es: "Ej. Relajación"           en: "E.g. Relaxation"
fields.category.helpText        es: "Elige una categoría existente o escribe una nueva"  en: "Choose an existing category or type a new one"
errors.nameRequired             es: "El nombre es obligatorio"          en: "Name is required"
errors.nameTooLong              es: "El nombre no puede exceder 120 caracteres"  en: "Name cannot exceed 120 characters"
errors.descriptionTooLong       es: "La descripción no puede exceder 1000 caracteres"  en: "Description cannot exceed 1000 characters"
errors.categoryTooLong          es: "La categoría no puede exceder 60 caracteres"  en: "Category cannot exceed 60 characters"
errors.durationInvalid          es: "La duración debe ser un número entero positivo de minutos"  en: "Duration must be a positive whole number of minutes"
errors.priceNegative            es: "El precio no puede ser negativo"   en: "Price cannot be negative"
```

**`services.actions.*`**

```bash
deactivate                  es: "Desactivar"                   en: "Deactivate"
reactivate                  es: "Reactivar"                    en: "Reactivate"
edit                        es: "Editar"                       en: "Edit"
```

**`services.deactivate.*`**

```bash
confirmTitle                es: "¿Desactivar este servicio?"   en: "Deactivate this service?"
confirmBody                 es: "Este servicio ya no aparecerá en nuevas reservas."  en: "This service will no longer appear for new bookings."
confirmBodyWithBookings     es: "Este servicio tiene {count} reserva(s) futura(s) (confirmadas o pendientes). Desactivarlo no las cancelará."  en: "This service has {count} future booking(s) (confirmed or pending). Deactivating it will not cancel them."
confirmButton               es: "Sí, desactivar"               en: "Yes, deactivate"
```

**`services.toast.*`**

```bash
created                     es: "Servicio creado correctamente."     en: "Service created successfully."
updated                     es: "Servicio actualizado correctamente." en: "Service updated successfully."
deactivated                 es: "Servicio desactivado."              en: "Service deactivated."
reactivated                 es: "Servicio reactivado."               en: "Service reactivated."
```

**`services.durationUnit`**: es: `"min"`, en: `"min"`.

Currency rendered via `Intl.NumberFormat` / next-intl (researcher to confirm options). Stored value is locale-independent (integer pesos).
* * *

## 9\. Gate 1 decisions (resolved 2026-05-03)

| # | Question | Decision |
| ---| ---| --- |
| 1 | Categories in v1, and what model? | Yes — owner-managed list. Combobox of previously-typed values + free-text new entry. No separate `categories` table; derived from service rows. |
| 2 | Price granularity | Whole pesos only. Stored as integer. (Stripe v2 will need a centavo-conversion layer at integration time — flagged for that future ticket.) |
| 3 | Single base price per service for v1 | Confirmed. No per-therapist surcharges, no discounts, no peak pricing, no packages. |
| 4 | "Future booking" definition for deactivation warning | `confirmed` + `pending`. Both count as upcoming for the warning purpose. (Booking domain spec doesn't exist yet — this is a placeholder assumption to revisit when bookings are specced.) |
| 5 | Per-studio service limit | No hard cap. UI designed assuming ≤50 services. Architect should not add a DB-level limit. |

* * *

## 10\. Research needed

The researcher should investigate before the architect starts:

1. **Price snapshot pattern for historical booking integrity.** Survey common Postgres approaches: (a) denormalized price snapshot column on the booking row, (b) price-version/ledger table with effective-from timestamps, (c) event-sourced service. Recommend the simplest approach compatible with Supabase RLS. Flag any v2 Stripe-integration implications (Stripe expects amounts in centavos; we store in whole pesos here).
2. **MXN currency formatting in bilingual context.** Confirm correct `Intl.NumberFormat` / next-intl options for `es-MX` and `en-US` locales — symbol (`$`, `MX$`, `MXN`), thousands separator, decimal separator, and how to disambiguate from USD for English-speaking users. Include browser-compat notes for `currencyDisplay: "narrowSymbol"`.
