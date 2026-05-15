# Studio Profile Setup — Spec

# Spec — Studio Profile Setup

**Ticket:** [CU-869d29f1h](https://app.clickup.com/t/869d29f1h)
**Status:** Spec (awaiting Gate 1 approval)
**Author:** product-manager (agent)
**Date:** 2026-05-03
**Roadmap reference:** v1 Roadmap, "Studio Setup" cluster
* * *

## 1\. Problem

A newly authenticated studio owner has no way to tell the platform who they are, where they operate, when they are open, or how customers and staff can reach them. Without this baseline, no other v1 feature (therapist roster, service catalog, bookings, daily schedule) has correct context, and even basic copy ("This is your studio, X") cannot render.

This problem occurs once at onboarding and recurs whenever the owner edits — most commonly during seasonal hour changes or a phone-number update.

The studio owner is the only user affected in v1. There are no customers or therapists touching studio-level data.
* * *

## 2\. User stories

1. As a studio owner, I want to set my studio's name so the platform identifies my business correctly.
2. As a studio owner, I want to enter my address so customers and staff know where to find me.
3. As a studio owner, I want to set opening hours per weekday — including marking a day as closed — so future booking and availability logic reflects when I actually operate.
4. As a studio owner, I want to provide a single phone number (which doubles as my WhatsApp) and an email so customers and staff have accurate contact info.
5. As a studio owner, I want to edit any profile field at any time and have changes saved reliably.
6. As a studio owner, I want clear inline validation when I enter an invalid value (e.g., a closing time earlier than the opening time) so I can fix it before saving.
* * *

## 3\. Acceptance criteria

**Profile data entry and persistence**

1. Given an authenticated owner with no profile data, when they navigate to the studio profile page, then they see an empty/onboarding state for each field with a clear prompt to complete their profile.
2. Given the studio profile form, when the owner submits a valid form, then values are persisted and displayed without a full-page reload.
3. The form contains: studio name (text, 1–100 chars), address (text, 0–200 chars), opening hours per weekday (7 weekdays), phone (text, 7–20 chars, doubles as WhatsApp), email (RFC-valid, 0–254 chars).
4. Studio name is required (non-empty after trim). Save is blocked with `studioProfile.field.name.error.required` when empty.
5. **At least one contact method (phone OR email) is required.** Save is blocked with `studioProfile.error.contactRequired` when both are empty.
6. Phone number, when present, accepts digits, spaces, dashes, parentheses, and a leading `+`. Pure-non-numeric input is rejected with `studioProfile.field.phone.error.invalid`.
7. Email, when present, must match standard email format. Invalid email is rejected with `studioProfile.field.email.error.invalid`.
8. Address is optional and free-form text in v1. Length cap 200 chars enforced both client and server side.

**Hours per weekday**

1. The hours section renders 7 weekdays (Monday through Sunday) in `America/Cancun` local time. Each weekday row has: a `Closed` toggle, an open-time picker, and a close-time picker. Open/close pickers are disabled when `Closed` is on.
2. Time pickers use **12-hour display format** (e.g., `9:00 AM`, `8:30 PM`). Internally values are stored as 24-hour `HH:MM` strings.
3. When a weekday is `Open`, both open and close times are required; submitting either empty is blocked with `studioProfile.hours.error.timeRequired`.
4. The close time must be strictly after the open time on the same day. Equal or earlier close time is rejected with `studioProfile.hours.error.closeBeforeOpen`. (Overnight ranges like 22:00–02:00 are out of scope for v1.)
5. When a weekday is `Closed`, it persists as a closed-day record (not as null hours) and renders as `Cerrado` / `Closed` in the locale.
6. All 7 weekdays are saved atomically: either all weekday records persist or none do (no partial state).

**Validation and submit feedback**

1. All field-level validation errors render simultaneously (not one at a time). When any error is present, the form does not call the API.
2. On submit of a valid form, the save button shows a loading state and is disabled to prevent double submission.
3. On success the owner sees a success toast (`studioProfile.toast.saveSuccess.*`) within 2 seconds of the response.
4. On network or server error the owner sees an error toast (`studioProfile.toast.saveError.*`) and the form retains its values (no data loss).

**Access control**

1. Given an authenticated user whose `auth.uid()` does not match the `owner_id` of the studio record, any read or write to the studio profile via the API returns 403. (Enforced at RLS — verified in integration tests.)
2. Given an unauthenticated request, the API returns 401.
* * *

## 4\. Out of scope

*   Photo / gallery upload (separate v2 ticket).
*   Multiple locations or multi-studio per owner (v2+).
*   Public-facing studio display (no customer flow yet).
*   Multi-language studio content. The platform UI is bilingual; the studio's own name/address/email/phone is entered once in whatever language the owner prefers.
*   Social media links.
*   Map / geocoding. Address is plain-text single-line in v1.
*   Time zone configuration. **TZ is fixed at** **`America/Cancun`** **in v1** (Quintana Roo is permanently UTC-5, no DST since 2015) — confirmed in the roadmap on 2026-04-26.
*   Overnight hours (close-time < open-time on same day).
*   A separate WhatsApp field. The phone field is treated as the WhatsApp number too — labelled accordingly in the UI (`Phone (also WhatsApp)` / `Teléfono (también WhatsApp)`).
* * *

## 5\. Edge cases and error states

*   **Empty / first-visit state:** all fields blank → onboarding state, no error.
*   **Partial save:** owner has filled only name + one contact method → valid, can save and revisit later.
*   **Concurrent edits:** v1 has one owner per studio. Last-write-wins is acceptable; no conflict UI required.
*   **Network failure mid-save:** form keeps entered data, retryable.
*   **Boundary values:** name max 100, address max 200, phone max 20, email max 254 (RFC 5321) — enforced both sides.
*   **Time entry:** time pickers only; no free-text time. Empty open/close on an `Open` day is a blocking error.
*   **Locale display:** weekday names + `Closed`/`Cerrado` render in active locale; time always displays in 12-hour format with locale-appropriate AM/PM.
* * *

## 6\. Analytics and success metrics

| Event | Properties | When fired |
| ---| ---| --- |
| `studio_profile_view` | `studio_id`, `profile_complete: bool` | Page load |
| `studio_profile_save_attempt` | `studio_id`, `fields_changed: string[]` | On submit (pre-API) |
| `studio_profile_save_success` | `studio_id`, `fields_changed: string[]`, `duration_ms` | On success response |
| `studio_profile_save_error` | `studio_id`, `error_type: validation | network | server` | On failure |
| `studio_profile_hours_day_toggled` | `studio_id`, `day`, `is_open: bool` | Owner toggles a day |

`fields_changed` lists field names only — never values (PII).

**Success metric (v1 pilot):** ≥80% of onboarded owners complete a save within 24h of first login. Leading: ≥1 `studio_profile_save_success` per new studio within 24h of first `studio_profile_view`.
* * *

## 7\. Roles and permissions

*   **Studio owner (authenticated):** full read/write to their own studio profile.
*   **Therapist:** no access in v1.
*   **Customer:** no access in v1.
*   **Unauthenticated:** no access (401).

**RLS dependency:** Pattern established by CU-869d29f1f (auth) — `auth.uid() = studios.owner_id`. The architect should design profile fields as part of the `studios` table (or a closely related `studios_profile` table — architect's call) and unify the RLS pattern across all studio-scoped resources (this spec, therapists, services).
* * *

## 8\. Localization

All user-facing strings ship with both `es` and `en` keys (next-intl), under the `studioProfile.*` namespace.

```perl
studioProfile.page.title                          es: "Perfil del estudio"            en: "Studio profile"
studioProfile.page.subtitle                       es: "Información básica de tu estudio"  en: "Basic info about your studio"
studioProfile.emptyState.heading                  es: "Completa tu perfil"            en: "Complete your profile"
studioProfile.emptyState.body                     es: "Agrega el nombre, dirección y horarios de tu estudio para empezar."  en: "Add your studio name, address, and hours to get started."
studioProfile.section.basicInfo                   es: "Información general"            en: "General information"
studioProfile.section.hours                       es: "Horarios de atención"           en: "Business hours"
studioProfile.section.contact                     es: "Información de contacto"        en: "Contact information"
studioProfile.field.name.label                    es: "Nombre del estudio"             en: "Studio name"
studioProfile.field.name.placeholder              es: "Ej. Tulum Healing Spa"          en: "E.g. Tulum Healing Spa"
studioProfile.field.name.error.required           es: "El nombre del estudio es obligatorio"  en: "Studio name is required"
studioProfile.field.name.error.maxLength          es: "El nombre no puede superar 100 caracteres"  en: "Name cannot exceed 100 characters"
studioProfile.field.address.label                 es: "Dirección"                      en: "Address"
studioProfile.field.address.placeholder           es: "Ej. Calle Centauro Sur, Tulum Centro"  en: "E.g. Calle Centauro Sur, Tulum Centro"
studioProfile.field.address.error.maxLength       es: "La dirección no puede superar 200 caracteres"  en: "Address cannot exceed 200 characters"
studioProfile.field.phone.label                   es: "Teléfono (también WhatsApp)"    en: "Phone (also WhatsApp)"
studioProfile.field.phone.placeholder             es: "+52 984 123 4567"               en: "+52 984 123 4567"
studioProfile.field.phone.error.invalid           es: "Ingresa un número de teléfono válido"  en: "Enter a valid phone number"
studioProfile.field.email.label                   es: "Correo electrónico"             en: "Email"
studioProfile.field.email.placeholder             es: "hola@tudominio.com"             en: "hello@yourdomain.com"
studioProfile.field.email.error.invalid           es: "Ingresa un correo electrónico válido"  en: "Enter a valid email address"
studioProfile.error.contactRequired               es: "Agrega al menos un teléfono o correo electrónico"  en: "Add at least a phone number or email"
studioProfile.hours.day.monday                    es: "Lunes"                          en: "Monday"
studioProfile.hours.day.tuesday                   es: "Martes"                         en: "Tuesday"
studioProfile.hours.day.wednesday                 es: "Miércoles"                      en: "Wednesday"
studioProfile.hours.day.thursday                  es: "Jueves"                         en: "Thursday"
studioProfile.hours.day.friday                    es: "Viernes"                        en: "Friday"
studioProfile.hours.day.saturday                  es: "Sábado"                         en: "Saturday"
studioProfile.hours.day.sunday                    es: "Domingo"                        en: "Sunday"
studioProfile.hours.closed                        es: "Cerrado"                        en: "Closed"
studioProfile.hours.open                          es: "Abierto"                        en: "Open"
studioProfile.hours.openTime.label                es: "Abre"                           en: "Opens"
studioProfile.hours.closeTime.label               es: "Cierra"                         en: "Closes"
studioProfile.hours.error.closeBeforeOpen         es: "La hora de cierre debe ser posterior a la hora de apertura"  en: "Close time must be after open time"
studioProfile.hours.error.timeRequired            es: "Ingresa la hora de apertura y cierre"  en: "Enter both open and close times"
studioProfile.action.save                         es: "Guardar cambios"                en: "Save changes"
studioProfile.action.saving                       es: "Guardando..."                   en: "Saving..."
studioProfile.toast.saveSuccess.title             es: "Perfil actualizado"             en: "Profile updated"
studioProfile.toast.saveSuccess.description       es: "Los cambios se guardaron correctamente."  en: "Your changes were saved."
studioProfile.toast.saveError.title               es: "Error al guardar"               en: "Save failed"
studioProfile.toast.saveError.description         es: "No se pudieron guardar los cambios. Intenta de nuevo."  en: "Could not save changes. Please try again."
```

The studio's own data (name, address, contact info) is not translated by the platform — owner enters it once in their preferred language.
* * *

## 9\. Gate 1 decisions (resolved 2026-05-03)

| # | Question | Decision |
| ---| ---| --- |
| 1 | Required fields | Studio name + at least one contact method (phone OR email). |
| 2 | Time display format | 12-hour (e.g., `1:00 PM`). |
| 3 | Time zone storage | Plain local `HH:MM`, fixed `America/Cancun` (per roadmap 2026-04-26). No TZ-aware storage in v1. |
| 4 | Concurrent edits | Last-write-wins, no notice. |
| 5 | WhatsApp field model | Single phone field doubling as WhatsApp ("Phone (also WhatsApp)"). No separate WhatsApp field. |

* * *

## 10\. Research needed

The researcher should investigate before the architect starts:

1. **Mexican phone validation:** What library or regex reliably validates Mexican phone numbers (mobile and landline, with optional `+52` prefix)? Note the value must be storable in **E.164 format** for any future Meta Cloud API / Twilio WhatsApp integration — flag the storage format for the architect.
2. **Time picker component:** Does `packages/ui` need a 12-hour time picker, or is a library required? Flag CSP-nonce implications (ADR-0006).
