# Design: Studio Profile

**Spec:** ClickUp Doc 8cjnt23-12332
**Ticket:** CU-869d29f1h
**Date:** 2026-05-03
**Author:** designer (agent)

---

## 1. Screens Involved

### Screen: Studio Profile (Edit)

- **URL pattern:** `/studio/profile`
- **Primary user goal:** View and update the studio's public-facing information — name, contact details, and operating hours — so that the platform reflects accurate information to customers and staff.
- **Layout:** `LayoutShell` header + main content. No sidebar. Single-page form. No modal for editing (the page IS the edit form — no view/edit toggle in v1). Max-width `container.content` (960px).

---

## 2. User Flows

### Flow A: Studio owner views and updates basic info

1. Owner navigates to `/studio/profile` (link in main nav — nav design deferred to auth feature; assume accessible from header).
2. Page loads. If data is being fetched, a skeleton matching the form layout is shown.
3. Once loaded, the form displays pre-filled values for studio name, phone, email, description, and hours.
4. Owner edits one or more fields.
5. Owner clicks the primary "Save" button (`studioProfile.action.save`).
6. Button enters loading state (`loading={true}`, spinner visible, interaction blocked).
7. On success: button returns to default; Toast `variant="success"` fires with `toast.success.saved.title` / `toast.success.saved.description`. Form retains new values.
8. On error: button returns to default; Toast `variant="error"` fires with `toast.error.generic.title`. Form retains edited (unsaved) values. Inline field errors appear if the API returns validation errors.

### Flow B: Saving with missing required fields

1. Owner clears the studio name and tries to save.
2. Client-side validation fires before the API call.
3. Studio name field shows inline error message (`studioProfile.field.name.error.required`).
4. Focus moves to the first invalid field.
5. The save button returns to its default state (was not loading — validation short-circuits the API call).
6. No toast is shown for validation errors.

### Flow C: Saving with missing contact (phone AND email both empty)

1. Owner clears both phone and email and tries to save.
2. Cross-field validation fires: at least one of phone or email is required.
3. Both fields show inline error (`studioProfile.field.contact.error.atLeastOne`).
4. Focus moves to the phone field (first of the two).

### Flow D: Setting hours for a day

1. Owner finds the day row (e.g., Monday).
2. If day is currently "Closed" (`studioProfile.hours.closed`), the "Closed" toggle is active and both time pickers are hidden.
3. Owner clicks/toggles the Closed switch off — day is now open. Time pickers for open and close times appear.
4. Owner sets open time (e.g., 9:00 AM) using the `TimePicker` component.
5. Owner sets close time (e.g., 7:00 PM) using the `TimePicker` component.
6. Validation: close time must be after open time. If violated, inline error on the close time picker: `studioProfile.hours.error.closeAfterOpen`.
7. Owner saves the whole form. Hours are stored internally as HH:MM (24h) but displayed as 12h format.

### Flow E: Closing a day that was previously open

1. Owner finds an open day row.
2. Owner toggles the "Closed" switch on.
3. Time pickers disappear immediately. The row shows only the "Closed" indicator.
4. Stored as `closed: true`; open/close times are discarded on save.

---

## 3. Component Inventory

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing (`docs/design/components/LayoutShell.md`) | Page wrapper |
| `PageHeader` | New — `docs/design/components/PageHeader.md` | Page title + save button |
| `FormSection` | New — `docs/design/components/FormSection.md` | Labeled section divider within the form |
| `TimePicker` | New — `docs/design/components/TimePicker.md` | 12h time picker for hours rows |
| `Button` | Existing (`docs/design/components/Button.md`) | Save, Cancel |
| `Toast` | Existing (`docs/design/components/Toast.md`) | Success / error feedback |
| `LoadingSkeleton` | Existing (`docs/design/components/LoadingSkeleton.md`) | Loading state |

No `ConfirmationDialog` needed — studio profile has no deactivation or destructive action.

---

## 4. New Components

All new components introduced here are specified in `docs/design/components/`. See:
- `PageHeader.md` — page title + primary action button
- `FormSection.md` — form section wrapper with title and optional description
- `TimePicker.md` — 12-hour time picker with AM/PM toggle

---

## 5. Page Layout

### Desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│  LayoutShell Header (sticky, h-16)                                 │
├────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                               │
│                                                                    │
│  ┌── max-w-[960px] mx-auto px-8 py-8 ───────────────────────────┐ │
│  │                                                                │ │
│  │  PageHeader                                                    │ │
│  │  ┌────────────────────────────────────────────────────────┐   │ │
│  │  │  [h2] studioProfile.page.title                         │   │ │
│  │  │  [p]  studioProfile.page.subtitle                      │   │ │
│  │  │                            [Button primary: Save]      │   │ │
│  │  └────────────────────────────────────────────────────────┘   │ │
│  │                                                                │ │
│  │  ── FormSection: studioProfile.section.basicInfo ────────     │ │
│  │                                                                │ │
│  │  [label] studioProfile.field.name.label *required             │ │
│  │  [input text, full-width]                                      │ │
│  │  [error if invalid]                                            │ │
│  │                                                                │ │
│  │  [label] studioProfile.field.description.label                │ │
│  │  [textarea, full-width, 4 rows]                                │ │
│  │                                                                │ │
│  │  ── FormSection: studioProfile.section.contact ──────────     │ │
│  │                                                                │ │
│  │  [label] studioProfile.field.phone.label                      │ │
│  │  [helper] studioProfile.field.phone.helper                    │ │
│  │  [input tel, full-width]                                       │ │
│  │  [error if invalid]                                            │ │
│  │                                                                │ │
│  │  [label] studioProfile.field.email.label                      │ │
│  │  [input email, full-width]                                     │ │
│  │  [error if invalid]                                            │ │
│  │                                                                │ │
│  │  ── FormSection: studioProfile.section.hours ────────────     │ │
│  │                                                                │ │
│  │  [p] studioProfile.hours.timezone.note                        │ │
│  │                                                                │ │
│  │  ┌── Hours table ──────────────────────────────────────────┐  │ │
│  │  │  MON  [Closed toggle]  [TimePicker open] [TimePicker close] │ │
│  │  │  TUE  [Closed toggle]  [TimePicker open] [TimePicker close] │ │
│  │  │  ... (7 rows)                                              │ │
│  │  └────────────────────────────────────────────────────────────┘ │
│  │                                                                │ │
│  │  ── Footer action bar ────────────────────────────────────    │ │
│  │  [Button secondary: Cancel]   [Button primary: Save]          │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  LayoutShell Footer                                                │
└────────────────────────────────────────────────────────────────────┘
```

### Form field widths

- Studio name: full-width
- Description: full-width textarea, `rows={4}`, `resize-y`, `max-h-48`
- Phone: max-width 320px (it's a short field; does not need to span the form)
- Email: max-width 400px
- Hours rows: full-width table

**On desktop, the "Contact" section lays out phone and email side-by-side in a 2-column grid** (`grid grid-cols-2 gap-6`) for visual efficiency. Each column is full-width within its cell.

### Tablet (768–1023px)

- Same layout as desktop.
- Phone and email stack to a single column (`grid-cols-1`).
- Container padding reduces to `px-6`.

### Mobile (375–767px)

- All fields full-width, single column.
- PageHeader title scales: `text-xl sm:text-2xl`.
- Save button in `PageHeader` moves below the title (stacks vertically) at `<sm` breakpoint.
- Footer action bar stacks: Cancel above Save, both `fullWidth`.
- Hours rows: day label is 3-letter abbreviation only. Closed toggle and time pickers stack in 2 rows if needed (day + toggle on row 1; pickers on row 2 only when open).
- Container padding: `px-4`.

---

## 6. Form Field Specifications

### Studio Name

- Input type: `text`
- Required: yes
- Validation: non-empty after trim
- Max length: 120 characters
- Error message key: `studioProfile.field.name.error.required`
- `aria-describedby` → error element id when invalid
- `aria-required="true"`

### Description

- Input type: `textarea`
- Required: no
- Max length: 500 characters
- Character count hint shown below textarea: `studioProfile.field.description.charCount` (`{count}/500`)
- No error state (optional field)

### Phone

- Input type: `tel`
- Required: conditional (at least one of phone or email must be present)
- Placeholder: `studioProfile.field.phone.placeholder` (e.g., `+52 984 123 4567`)
- Helper text below field: `studioProfile.field.phone.helper` (explains doubles as WhatsApp)
- Error key: `studioProfile.field.contact.error.atLeastOne`

### Email

- Input type: `email`
- Required: conditional (see phone above)
- Error key (format invalid): `studioProfile.field.email.error.format`
- Error key (cross-field): `studioProfile.field.contact.error.atLeastOne`

### Hours Section

Seven rows, one per day (Monday through Sunday). Day order: Monday first, Sunday last (consistent with Mexico/Latin America convention).

Each row:

```
[Day label: full name, text-sm font-medium text-neutral-700, w-28]
[Closed switch: role="switch", aria-checked, aria-label includes day name]
[if NOT closed:]
  [TimePicker: open time, label=studioProfile.hours.open]
  [separator: text-neutral-400 "–"]
  [TimePicker: close time, label=studioProfile.hours.close]
[if closed:]
  [span: studioProfile.hours.closedLabel, text-sm text-neutral-400]
[validation error: close-after-open, shown below the row if violated]
```

Day labels use i18n keys: `common.day.monday` through `common.day.sunday` (full names for accessibility). Mobile uses abbreviation keys `common.day.mon` etc. for the visual label but the Closed switch `aria-label` always uses the full name.

**Timezone note:** A single line below the section title: `studioProfile.hours.timezone.note` — "All times are in Cancun time (CST/CDT)." This is informational only; no selector.

---

## 7. Interaction and Motion

- **Field focus:** Standard focus ring (`focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2`). `motion-safe:transition-colors motion-safe:duration-150`.
- **Closed switch toggle:** Immediate visual state change. TimePicker appearance uses `motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out` for height/opacity. When reduced motion is active, pickers appear/disappear instantly.
- **Save button loading:** Spinner replaces icon slot. `motion-safe:animate-spin`.
- **Toast enter:** Slide in from bottom-right, `250ms ease-out`. See Toast spec.
- **No page-level animations.** The form is static; no scroll-triggered effects.

---

## 8. Empty / Error / Loading States

### Loading (initial page load)

The form is populated from an API fetch. While fetching, show a skeleton layout matching the form:

```
PageHeader skeleton:
  LoadingSkeleton height="2rem" width="240px"    ← title
  LoadingSkeleton height="1rem" width="320px" mt-2  ← subtitle
  LoadingSkeleton height="2.5rem" width="96px" (button shape, floated right)

FormSection skeleton (BasicInfo):
  LoadingSkeleton height="1rem" width="120px"  ← label
  LoadingSkeleton height="2.5rem" width="100%"  ← input
  LoadingSkeleton height="1rem" width="120px" mt-4  ← label
  LoadingSkeleton height="6rem" width="100%"    ← textarea

FormSection skeleton (Contact):
  [2 columns on desktop, 1 on mobile — matching the real layout]
  LoadingSkeleton height="1rem" width="80px" ← label
  LoadingSkeleton height="2.5rem" width="100%" ← input
  LoadingSkeleton height="1rem" width="80px" ← label
  LoadingSkeleton height="2.5rem" width="100%" ← input

FormSection skeleton (Hours):
  7 rows of:
    LoadingSkeleton height="1.5rem" width="100px" ← day
    LoadingSkeleton height="1.5rem" width="40px" ← toggle
    LoadingSkeleton height="2.5rem" width="120px" ← open picker
    LoadingSkeleton height="2.5rem" width="120px" ← close picker
```

Container: `aria-busy="true" aria-label={t('studioProfile.loading')} aria-live="polite"`.

### Empty (no profile data yet — first run)

The API returns an empty/default profile object. The form renders with blank fields. A soft callout banner appears below the `PageHeader`:

```
[info.50 bg, info.500 left border, p-4 rounded-lg]
[Info icon (Lucide `Info`, text-info-500)]
[studioProfile.empty.title — text-sm font-medium text-neutral-700]
[studioProfile.empty.body — text-sm text-neutral-500]
```

This is not a blocker — the studio owner can simply fill in the form. No empty illustration. The save button is enabled even when blank (validation runs on submit).

### Error (failed to load profile)

If the initial API call fails, do not show the form skeleton. Show an error state in the main content area:

```
[danger.50 bg, danger.500 left border, p-6 rounded-lg]
[AlertCircle icon (Lucide, text-danger-500)]
[studioProfile.loadError.title — text-neutral-700 font-medium]
[studioProfile.loadError.body — text-sm text-neutral-500]
[Button secondary: studioProfile.loadError.retry → triggers re-fetch]
```

### Saving (in-progress)

- Save button: `loading={true}`.
- All form fields remain enabled (do not lock the form — avoids flicker if save is instant).
- On a slow connection, the spinner communicates progress.

### Save error (API returns error)

- Toast `variant="error"` with `toast.error.generic.title` / description.
- If the API returns field-level errors (e.g., invalid email format from backend), show inline errors on the relevant fields with `aria-invalid="true"`.
- Focus moves to the first invalid field.

### No permission

If the user somehow reaches this page without owner role (edge case — auth is a separate ticket):

```
[warning.50 bg, warning.500 left border]
[warning icon]
[studioProfile.permission.title]
[studioProfile.permission.body]
```

No form is shown.

---

## 9. Copy Keys

All keys are references to the i18n message files. The developer-fe populates `es.json` and `en.json` simultaneously.

| Key | es | en |
|---|---|---|
| `studioProfile.page.title` | Perfil del estudio | Studio profile |
| `studioProfile.page.subtitle` | Información visible en tu página pública | Information visible on your public page |
| `studioProfile.action.save` | Guardar cambios | Save changes |
| `studioProfile.action.cancel` | Cancelar | Cancel |
| `studioProfile.section.basicInfo` | Información general | General information |
| `studioProfile.section.contact` | Contacto | Contact |
| `studioProfile.section.hours` | Horario de atención | Operating hours |
| `studioProfile.field.name.label` | Nombre del estudio | Studio name |
| `studioProfile.field.name.error.required` | El nombre del estudio es obligatorio | Studio name is required |
| `studioProfile.field.description.label` | Descripción | Description |
| `studioProfile.field.description.charCount` | {count}/500 | {count}/500 |
| `studioProfile.field.phone.label` | Teléfono (también WhatsApp) | Phone (also WhatsApp) |
| `studioProfile.field.phone.placeholder` | +52 984 123 4567 | +52 984 123 4567 |
| `studioProfile.field.phone.helper` | Este número se usará también para mensajes de WhatsApp | This number will also be used for WhatsApp messages |
| `studioProfile.field.email.label` | Correo electrónico | Email address |
| `studioProfile.field.email.error.format` | Ingresa un correo válido | Enter a valid email address |
| `studioProfile.field.contact.error.atLeastOne` | Debes ingresar al menos un método de contacto (teléfono o correo) | You must provide at least one contact method (phone or email) |
| `studioProfile.hours.timezone.note` | Los horarios son en hora de Cancún (CST/CDT) | Times are in Cancún time (CST/CDT) |
| `studioProfile.hours.open` | Apertura | Open |
| `studioProfile.hours.close` | Cierre | Close |
| `studioProfile.hours.closed` | Cerrado | Closed |
| `studioProfile.hours.closedLabel` | Cerrado | Closed |
| `studioProfile.hours.toggleClosed.label` | Marcar {day} como cerrado | Mark {day} as closed |
| `studioProfile.hours.toggleOpen.label` | Marcar {day} como abierto | Mark {day} as open |
| `studioProfile.hours.error.closeAfterOpen` | La hora de cierre debe ser posterior a la de apertura | Close time must be after open time |
| `studioProfile.loading` | Cargando perfil del estudio | Loading studio profile |
| `studioProfile.empty.title` | Completa tu perfil | Complete your profile |
| `studioProfile.empty.body` | Agrega el nombre y al menos un método de contacto para comenzar | Add your studio name and at least one contact method to get started |
| `studioProfile.loadError.title` | No se pudo cargar el perfil | Could not load profile |
| `studioProfile.loadError.body` | Ocurrió un error al cargar los datos del estudio. | An error occurred while loading studio data. |
| `studioProfile.loadError.retry` | Reintentar | Retry |
| `studioProfile.permission.title` | Sin acceso | Access denied |
| `studioProfile.permission.body` | No tienes permiso para ver esta página. | You do not have permission to view this page. |
| `common.day.monday` | Lunes | Monday |
| `common.day.tuesday` | Martes | Tuesday |
| `common.day.wednesday` | Miércoles | Wednesday |
| `common.day.thursday` | Jueves | Thursday |
| `common.day.friday` | Viernes | Friday |
| `common.day.saturday` | Sábado | Saturday |
| `common.day.sunday` | Domingo | Sunday |
| `common.day.mon` | Lun | Mon |
| `common.day.tue` | Mar | Tue |
| `common.day.wed` | Mié | Wed |
| `common.day.thu` | Jue | Thu |
| `common.day.fri` | Vie | Fri |
| `common.day.sat` | Sáb | Sat |
| `common.day.sun` | Dom | Sun |

---

## 10. Design Tokens Used

No new tokens introduced. All existing tokens apply.

- **Colors:** `neutral.50` (page bg), `white` (form bg, card bg), `neutral.200` (input border default), `neutral.500` (input border, label secondary), `neutral.700` (label primary, body text), `neutral.800` (headings), `brand.600` (focus ring, links), `brand.700` (primary button bg), `danger.500` (error border, icon), `danger.50` (error bg), `danger.700` (error text), `info.50`, `info.500` (info banner), `warning.50`, `warning.500` (permission banner)
- **Typography:** `text-2xl font-bold font-heading` (page title), `text-sm` (labels, helper text, error messages), `text-base` (input text), `text-xs` (character count)
- **Spacing:** `gap-6` (form field gap), `py-8` (page top/bottom padding), `px-8 lg` / `px-4 mobile`
- **Border radius:** `rounded-lg` (inputs, cards), `rounded-2xl` (sections)
- **Shadow:** `shadow-sm` (form card if sectioned)
- **Motion:** `duration-150 ease-out` (field transitions), `duration-[250ms] ease-out` (time picker reveal)

---

## 11. Accessibility Checklist

- [x] Keyboard reachable — all inputs, switches, time pickers, and buttons in logical DOM order
- [x] Focus visible — `focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2` on all interactive elements
- [x] Color contrast — all text/background pairs from existing token baseline pass WCAG 2.1 AA
- [x] Screen reader labels — all form fields have `<label>` elements with `for`/`htmlFor`; Closed switch has `aria-label` including day name; icon-only elements have `aria-label`
- [x] No information conveyed by color alone — required fields marked with `*` AND visually-hidden `(required)` sr-only text; errors shown with icon + text, not just red color
- [x] Form errors announced to screen readers — `aria-invalid="true"` and `aria-describedby` on invalid inputs; error message has `id` matching `aria-describedby`; on submit with errors, focus moves to first invalid field
- [x] TimePicker keyboard navigation — specified in `TimePicker.md`
- [x] Closed switch — `role="switch"` with `aria-checked`; pressing Space toggles
- [x] Reduced motion — TimePicker reveal uses `motion-safe:` modifier; skeleton shimmer uses `motion-safe:before:animate-none`

---

## 12. Responsive Notes

**Desktop (≥1024px):** Two-column grid for contact fields. Day labels show full names. Form centered in 960px container.

**Tablet (768–1023px):** Contact fields stack to single column. Spacing reduces (`px-6`). Hours rows remain in a single row per day.

**Mobile (375–767px):**
- PageHeader: title and button stack vertically; button becomes `fullWidth`.
- All fields single column.
- Phone and email each take 100% width.
- Hours: day label shows 3-letter abbreviation. Closed toggle and time pickers may wrap onto a second line for each day row. The row uses `flex-wrap` to allow wrapping: `[Day label][Closed toggle]` on line 1; `[Open picker] – [Close picker]` on line 2 (only shown when day is open).
- Footer action bar: Cancel and Save stack vertically, both `fullWidth`, Save on top.
- Time pickers on mobile: drop-down style fallback is acceptable; see `TimePicker.md` for mobile behavior.

---

## 13. Open Questions

1. **Navigation entry point:** The studio profile page is reachable from — where exactly? The main nav (header) design is deferred to the auth ticket. Until auth and nav are specced, the URL is known but the nav link position is TBD. Developer-fe should expose the route; nav wiring comes later.
2. **Cancel behavior:** Does "Cancel" discard unsaved changes and reload from API, or navigate away? For v1, recommend: reload from API (discards edits, stays on same page). Confirm with PM.
3. **Profile image / logo:** Out of scope for v1 per spec, but the BasicInfo section has no avatar slot. Confirm there is no photo upload in this wave — if so, a placeholder slot could be stubbed for later.
4. **Description character limit:** Spec says optional, max 500 chars. Confirm max is correct.
