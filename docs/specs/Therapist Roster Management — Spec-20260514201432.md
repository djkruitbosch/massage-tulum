# Therapist Roster Management — Spec

# Spec — Therapist Roster Management

**Ticket:** [CU-869d29f1p](https://app.clickup.com/t/869d29f1p)
**Status:** Spec (awaiting Gate 1 approval)
**Author:** product-manager (agent)
**Date:** 2026-05-03
**Roadmap reference:** v1 Roadmap, "Studio Setup" cluster
* * *

## 1\. Problem

A typical Tulum studio employs 3–10 therapists. Today, owners track their roster in WhatsApp groups, notes apps, or memory. There is no authoritative source of truth for who works at the studio and whether they are currently active. This blocks every downstream feature: bookings can't be assigned to a specific therapist, deactivated therapists keep appearing in pickers, and historical bookings risk losing their therapist reference.

This is a v1 prerequisite for scheduling (CU-869d29f2z) and bookings (CU-869d29f2c).

Primary user: the **studio owner** (single-account-per-studio in v1).
Secondary impact: none — therapists do not have logins in v1.
* * *

## 2\. User stories

1. As a studio owner, I want to add a therapist with name and role/title (and optionally notes + contact info), so I have a record of who works at my studio.
2. As a studio owner, I want to edit a therapist's details, so I can keep the roster accurate.
3. As a studio owner, I want to deactivate a therapist without deleting them, so past bookings still show who performed the service while they no longer appear in future scheduling.
4. As a studio owner, I want to reactivate a therapist who returns after a break.
5. As a studio owner, I want to see a filterable list of all my therapists (active + deactivated) with status at a glance.
6. As a studio owner, I want the system to prevent me from accidentally hard-deleting a therapist who has historical bookings, so I never lose service-attribution records.
* * *

## 3\. Acceptance criteria

**Add therapist**

1. Given an authenticated owner on the roster page, when they submit Add Therapist with valid `name` (1–120 chars) and `role` (1–80 chars), then a new therapist record is created with `status = active`, scoped to their `studio_id`, and appears at the top of the Active list.
2. Optional fields on the form: `notes` (0–500 chars, owner-internal only), `phone` (0–20 chars), `email` (RFC-valid, 0–254 chars).
3. Empty `name` → inline error `therapists.form.name.error.required`, no API call.
4. Empty `role` → `therapists.form.role.error.required`, no API call.
5. `name` > 120 → `therapists.form.name.error.maxLength`. `role` > 80 → `therapists.form.role.error.maxLength`. `notes` > 500 → `therapists.form.notes.error.maxLength`. `email` invalid → `therapists.form.email.error.invalid`. `phone` non-numeric → `therapists.form.phone.error.invalid`.
6. On API error → toast (`toast.error.network` for network) + form retains entered data (no loss).

**Edit therapist**

1. Given an existing therapist (active or inactive), when the owner edits any field and saves, then values persist and the list updates within the same page session, success toast `therapists.toast.updated`.
2. Same validation as #3–#5 on edit.
3. Deactivated therapists are still editable (rename / re-title is allowed).

**Deactivate**

1. Given an active therapist, when the owner clicks Deactivate, then a confirmation dialog appears showing `therapists.deactivate.confirm.title` + `therapists.deactivate.confirm.body` **plus** the soft warning `therapists.deactivate.confirm.warning` ("This therapist may have upcoming bookings — check your schedule"). The warning is **always shown** in v1 (regardless of actual booking state — no API pre-flight required).
2. On confirm: `status` flips to `inactive`, therapist moves from Active list to Deactivated list, success toast `therapists.toast.deactivated`. The exact effect on availability slots is owned by CU-869d29f2z (availability) and the booking module — this spec confirms only the status change.
3. On dialog dismiss: no change.

**Reactivate**

1. Given a deactivated therapist, when the owner clicks Reactivate and confirms (`therapists.reactivate.confirm.*`), then `status` flips to `active`, therapist moves to the Active list, success toast `therapists.toast.reactivated`.

**List view**

1. Given the roster page, all therapists in the owner's studio load. Each row shows name, role, status badge, and (if present) phone/email/notes preview.
2. Filter: `Active` / `Deactivated` / `All`. Default `Active`.
3. Empty state (zero therapists): show `therapists.list.empty.*` with a CTA opening the Add form.
4. **No pagination** in v1 — load-all. Layout designed for ≤15 therapists; remains usable beyond that but UX revisited if >25 actually occur.

**Hard-delete prevention**

1. The UI exposes no Delete action — only Deactivate.
2. If a therapist has any associated booking records, a direct API delete returns 409 `{ "error": "therapist_has_bookings" }` and the record is not removed.
3. A therapist with zero bookings _may_ be hard-deletable via API (architect's call), but the UI exposes only Deactivate in v1.

**Authorization**

1. Any request for a therapist scoped to a studio the user does not own → 403. Enforced at Supabase RLS.
2. Unauthenticated request → 401.
* * *

## 4\. Out of scope

*   Therapist self-service login, portal, or account (v2+).
*   Therapist profile photos / image galleries (v2+).
*   Therapist availability / schedule configuration — that is CU-869d29f2z.
*   WhatsApp / email notifications to therapists — that is CU-869d29f3y.
*   Therapist performance analytics or ratings.
*   Multi-studio ownership (one owner, multiple studios) — v2+.
*   Bulk import (CSV upload) — v2+.
*   Service-to-therapist mapping (which therapists deliver which service) — separate concern, likely under availability.
*   Customer-facing therapist roster.
* * *

## 5\. Edge cases and error states

*   **Boundary inputs:** name/role/notes/phone/email enforce min/max as in #2 and #5. Whitespace-only inputs treated as empty.
*   **Network failure:** form retains data; `toast.error.network`; no optimistic update — wait for server confirmation before list update.
*   **Concurrent edits:** v1 has one owner per studio, so concurrent edits unlikely. Last-write-wins acceptable; no optimistic locking.
*   **Deactivating a therapist with future bookings:** v1 makes no automatic side effect. The "may have upcoming bookings" warning is always shown (per #10) as a soft guard rail. Cancellation logic belongs to the booking module.
*   **Reactivating a therapist:** no automatic restoration of any availability schedule that was removed during deactivation.
*   **Localization of status labels:** `active`/`inactive` stored as enum DB values. UI renders localized strings via `therapists.status.*`.
*   **Empty roster:** show empty state with CTA (#16).
* * *

## 6\. Analytics and success metrics

| Event | Properties | When fired |
| ---| ---| --- |
| `therapist_added` | `studio_id`, `therapist_id`, `has_notes: bool`, `has_phone: bool`, `has_email: bool` | Successful POST (server side) |
| `therapist_edited` | `studio_id`, `therapist_id`, `fields_changed: string[]` | Successful PATCH (server side) |
| `therapist_deactivated` | `studio_id`, `therapist_id` | Successful status → inactive |
| `therapist_reactivated` | `studio_id`, `therapist_id` | Successful status → active |
| `therapist_roster_viewed` | `studio_id`, `active_count: int`, `inactive_count: int`, `filter_applied: string` | Page load + filter change |

All events server-side (NestJS). `fields_changed` lists names only — never values (PII).

**Success metrics**

*   Primary: every studio that has accepted ≥1 booking has ≥1 active therapist on the roster (proxy for "owners use the roster as a booking prerequisite").
*   Secondary: deactivation rate <50% of total therapists added in first 30 days (high rate suggests deactivate is being used as a workaround for something broken).
*   Health check: zero `therapist_has_bookings` 409s logged in production (confirms the UI never attempts hard delete).
* * *

## 7\. Roles and permissions

*   **Studio owner only.** Full CRUD on therapists in their studio.
*   **Therapist:** no login, no permissions in v1.
*   **Customer:** no access.

**RLS pattern (mirrors auth + profile + services):**

```sql
auth.uid() = (SELECT owner_id FROM studios WHERE id = therapists.studio_id)
```

Apply to SELECT/INSERT/UPDATE/DELETE on `therapists`. Architect should confirm a single helper function or pattern is reused across all studio-scoped resources (this spec, profile, services).
* * *

## 8\. Localization

New keys under `therapists.*` namespace:

```python
therapists.page.title                      es: "Terapeutas"                   en: "Therapists"
therapists.page.subtitle                   es: "Gestiona el equipo de tu estudio"  en: "Manage your studio's team"
therapists.list.empty.title                es: "Aún no tienes terapeutas"     en: "You don't have any therapists yet"
therapists.list.empty.body                 es: "Agrega tu primer terapeuta para comenzar a asignar citas."  en: "Add your first therapist to start assigning bookings."
therapists.list.empty.cta                  es: "Agregar terapeuta"            en: "Add therapist"
therapists.filter.all                      es: "Todos"                        en: "All"
therapists.filter.active                   es: "Activos"                      en: "Active"
therapists.filter.deactivated              es: "Inactivos"                    en: "Deactivated"
therapists.status.active                   es: "Activo"                       en: "Active"
therapists.status.inactive                 es: "Inactivo"                     en: "Inactive"
therapists.add.title                       es: "Agregar terapeuta"            en: "Add therapist"
therapists.edit.title                      es: "Editar terapeuta"             en: "Edit therapist"
therapists.form.name.label                 es: "Nombre"                       en: "Name"
therapists.form.name.placeholder           es: "Ej. María González"           en: "E.g. María González"
therapists.form.name.error.required        es: "El nombre es obligatorio"     en: "Name is required"
therapists.form.name.error.maxLength       es: "El nombre no puede superar los 120 caracteres"  en: "Name cannot exceed 120 characters"
therapists.form.role.label                 es: "Cargo / Especialidad"         en: "Role / Specialty"
therapists.form.role.placeholder           es: "Ej. Masajista terapéutico"    en: "E.g. Therapeutic massage therapist"
therapists.form.role.error.required        es: "El cargo es obligatorio"      en: "Role is required"
therapists.form.role.error.maxLength       es: "El cargo no puede superar los 80 caracteres"  en: "Role cannot exceed 80 characters"
therapists.form.notes.label                es: "Notas internas"               en: "Internal notes"
therapists.form.notes.placeholder          es: "Solo visibles para ti"        en: "Visible only to you"
therapists.form.notes.helpText             es: "Hasta 500 caracteres"         en: "Up to 500 characters"
therapists.form.notes.error.maxLength      es: "Las notas no pueden superar los 500 caracteres"  en: "Notes cannot exceed 500 characters"
therapists.form.phone.label                es: "Teléfono (referencia interna)"  en: "Phone (internal reference)"
therapists.form.phone.placeholder          es: "+52 984 123 4567"              en: "+52 984 123 4567"
therapists.form.phone.error.invalid        es: "Ingresa un número de teléfono válido"  en: "Enter a valid phone number"
therapists.form.email.label                es: "Correo electrónico (referencia interna)"  en: "Email (internal reference)"
therapists.form.email.placeholder          es: "terapeuta@ejemplo.com"        en: "therapist@example.com"
therapists.form.email.error.invalid        es: "Ingresa un correo electrónico válido"  en: "Enter a valid email address"
therapists.action.add                      es: "Agregar terapeuta"            en: "Add therapist"
therapists.action.edit                     es: "Editar"                       en: "Edit"
therapists.action.deactivate               es: "Desactivar"                   en: "Deactivate"
therapists.action.reactivate               es: "Reactivar"                    en: "Reactivate"
therapists.action.save                     es: "Guardar cambios"              en: "Save changes"
therapists.deactivate.confirm.title        es: "¿Desactivar terapeuta?"       en: "Deactivate therapist?"
therapists.deactivate.confirm.body         es: "Este terapeuta no aparecerá en los turnos disponibles. Sus citas anteriores se conservarán."  en: "This therapist will no longer appear in available slots. Their past bookings will be preserved."
therapists.deactivate.confirm.warning      es: "Este terapeuta puede tener citas próximas. Revisa tu agenda."  en: "This therapist may have upcoming bookings — check your schedule."
therapists.reactivate.confirm.title        es: "¿Reactivar terapeuta?"        en: "Reactivate therapist?"
therapists.reactivate.confirm.body         es: "Este terapeuta volverá a estar disponible para asignar citas."  en: "This therapist will be available for booking assignment again."
therapists.toast.added                     es: "Terapeuta agregado"           en: "Therapist added"
therapists.toast.updated                   es: "Cambios guardados"            en: "Changes saved"
therapists.toast.deactivated               es: "Terapeuta desactivado"        en: "Therapist deactivated"
therapists.toast.reactivated               es: "Terapeuta reactivado"         en: "Therapist reactivated"
```

Reuse existing keys for generic actions (Cancel, Save, network errors).
* * *

## 9\. Gate 1 decisions (resolved 2026-05-03)

| # | Question | Decision |
| ---| ---| --- |
| 1 | Internal notes field in v1? | Yes, max 500 chars. |
| 2 | Therapist contact info (phone/email) in v1? | Yes — but researcher must assess Mexican LFPDPPP / GDPR implications before architect proceeds (see §10). |
| 3 | Notes max length | 500 chars. |
| 4 | Deactivation-with-future-bookings warning | Always show the soft warning regardless of actual booking state. No API pre-flight required in v1. |
| 5 | Pagination | None. Load-all. UI designed for ≤15 therapists. |

* * *

## 10\. Research needed

The researcher must investigate before the architect designs the data model:

1. **Mexican LFPDPPP / GDPR implications of storing therapist personal contact data.** The therapist is an individual whose phone/email is being stored without their direct consent to this platform (the studio owner enters it). Required output: (a) is this lawful under LFPDPPP for an internal-only purpose? (b) what disclosure obligation, if any, does the studio owner have to the therapist? (c) are there storage/retention/encryption requirements that affect the schema or RLS design? (d) recommend a one-line UI disclosure copy if needed.
2. Note: this research **gates the architect** for the contact-info portion of the spec. If the answer is "do not store without explicit therapist consent", the architect should design a deferred-consent flow (or the contact fields should be cut from v1 — escalate back to PM/human).
3. **Mexican phone validation** (shared with studio profile spec): same library/regex question. Resolve once, reuse.
