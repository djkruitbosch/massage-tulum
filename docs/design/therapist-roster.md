# Design: Therapist Roster

**Spec:** ClickUp Doc 8cjnt23-12372
**Ticket:** CU-869d29f1p
**Date:** 2026-05-03 (updated 2026-05-03 — Gate 2 patch: photo upload added to scope)
**Author:** designer (agent)

---

## 1. Screens Involved

### Screen A: Therapist List

- **URL pattern:** `/studio/therapists`
- **Primary user goal:** See all therapists at a glance, filter by status, and take quick actions (add, edit, deactivate, reactivate).
- **Layout:** `LayoutShell` + `PageHeader` + `FilterBar` + list of therapist cards/rows. Max-width `container.content` (960px). No sidebar.

### Screen B: Add Therapist (modal)

- **URL pattern:** `/studio/therapists` (same page — modal overlays the list)
- **Primary user goal:** Create a new therapist record.
- **Layout:** `ConfirmationDialog` component used in "form mode" — a modal centered on the page with a single-column form inside.

### Screen C: Edit Therapist (modal)

- **URL pattern:** `/studio/therapists` (same page — modal)
- **Primary user goal:** Update an existing therapist's details.
- **Layout:** Same modal as Add, pre-filled with existing data.

### Screen D: Deactivate Therapist (confirmation modal)

- **URL pattern:** `/studio/therapists` (same page — modal)
- **Primary user goal:** Confirm deactivation of a therapist with the mandatory soft-delete warning.
- **Layout:** `ConfirmationDialog` in destructive mode. Small modal, no form.

### Screen E: Reactivate Therapist (confirmation modal)

- **URL pattern:** `/studio/therapists` (same page — modal)
- **Primary user goal:** Confirm reactivation of a deactivated therapist.
- **Layout:** `ConfirmationDialog` in neutral/confirm mode.

---

## 2. User Flows

### Flow A: View active therapists (default view)

1. Owner navigates to `/studio/therapists`.
2. Page loads. List is fetched from API.
3. While fetching, skeleton rows appear (3 skeleton rows — mirrors expected data shape).
4. On success, the list renders with all **active** therapists (default filter = Active).
5. Each row shows: name, role, and action buttons (Edit, Deactivate).
6. `FilterBar` shows "Active | Deactivated | All" with "Active" selected.

### Flow B: Filter to see deactivated therapists

1. Owner clicks "Deactivated" in the `FilterBar`.
2. List re-renders showing only deactivated therapists.
3. Each row shows: name, role, a "Deactivated" status pill, and an action button (Reactivate only — no Edit offered for deactivated therapists in v1).
4. If no deactivated therapists exist: empty state for "Deactivated" filter.

### Flow C: Add a new therapist

1. Owner clicks `therapistRoster.action.addTherapist` (PageHeader primary CTA).
2. Add modal opens. Focus moves to the first field (Name).
3. Owner fills in name (required), role (required), and optionally phone, email, notes.
4. Owner may optionally upload a photo (see Flow C1 below).
5. Owner clicks `therapistRoster.action.save`.
6. Button enters loading state.
7. On success: modal closes; focus returns to the "Add Therapist" button; Toast success fires; new therapist appears at top of active list with avatar (photo or initials).
8. On error: Toast error fires; modal stays open; inline field errors if API returns them.

### Flow C1: Upload photo in Add or Edit modal

1. Owner clicks `therapistRoster.avatar.uploadPhoto` (or `therapistRoster.avatar.replacePhoto` if editing).
2. OS file picker opens.
3. Owner selects a file.
4. **Client-side validation fires before upload:**
   - If file type is not PNG / JPEG / WebP: error message appears below the avatar (`therapistRoster.avatar.error.fileType`). No upload occurs.
   - If file size exceeds 2 MB: error message appears below the avatar (`therapistRoster.avatar.error.fileSize`). No upload occurs.
5. If validation passes: the Avatar enters uploading state (LoadingSkeleton shimmer over the circle). Upload fires to Supabase Storage.
6. On upload success: Avatar renders the new photo. Upload controls switch to Replace/Remove state.
7. On upload failure: Avatar reverts to previous state (initials or prior photo). Error message appears: `therapistRoster.avatar.error.uploadFailed`. Owner may try again.
8. **The photo URL is not committed until the owner saves the form.**

### Flow C2: Remove photo in Edit modal

1. Owner clicks `therapistRoster.avatar.removePhoto`.
2. Avatar immediately reverts to initials (optimistic UI — no confirmation dialog).
3. Undo toast fires with 8-second duration and "Undo" action.
4. If owner clicks Undo within 8 seconds: photo is restored in the form; removal is discarded.
5. If owner saves before clicking Undo: removal is committed on save.
6. If toast expires without Undo: the photo removal is committed on next save.

### Flow D: Edit a therapist

1. Owner clicks the Edit icon button on a therapist row.
2. Edit modal opens, pre-filled with existing data (including photo if one exists). Focus moves to the Name field.
3. Owner modifies fields and/or photo and clicks Save.
4. Same success/error behavior as Add.
5. On success: modal closes; focus returns to the triggering Edit button; Toast success fires; list row updates with new data and avatar.

### Flow E: Deactivate a therapist

1. Owner clicks the Deactivate icon/button on an active therapist row.
2. `ConfirmationDialog` opens in destructive mode. Focus moves to the dialog.
3. Dialog always shows the warning: `therapistRoster.deactivate.warning` ("This therapist may have upcoming bookings — check your schedule before deactivating.").
4. Owner reads the warning, then clicks `therapistRoster.action.deactivateConfirm`.
5. Button enters loading state.
6. On success: dialog closes; focus returns to the Deactivate button (now replaced by the Reactivate button in the Deactivated filter, or hidden in Active filter); Toast success fires.
7. On cancel: dialog closes; no change; focus returns to the Deactivate button.

### Flow F: Reactivate a therapist

1. Owner filters to "Deactivated".
2. Owner clicks Reactivate on a therapist row.
3. `ConfirmationDialog` opens in neutral/confirm mode.
4. Simple confirmation: `therapistRoster.reactivate.body`.
5. Owner confirms. On success: dialog closes; therapist disappears from the Deactivated list (now appears in Active); Toast success fires.

---

## 3. Component Inventory

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing | Page wrapper |
| `PageHeader` | New — `docs/design/components/PageHeader.md` | Title + "Add therapist" button |
| `FilterBar` | New — `docs/design/components/FilterBar.md` | Active / Deactivated / All segment |
| `TherapistRow` | New (inline — no separate spec file; simple enough) | List row — see §4 below |
| `Avatar` | New — `docs/design/components/Avatar.md` | Therapist photo or initials; sm in list row, lg in modal |
| `StatusPill` | New — `docs/design/components/StatusPill.md` | Active / Deactivated badge |
| `ConfirmationDialog` | New — `docs/design/components/ConfirmationDialog.md` | Used for deactivate, reactivate, AND as a shell for Add/Edit form modals |
| `Button` | Existing | Primary CTAs, icon actions |
| `Toast` | Existing | Success / error feedback |
| `LoadingSkeleton` | Existing | Loading state rows |

---

## 4. Therapist List Layout

### Desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│  PageHeader                                                        │
│  [h2] therapistRoster.page.title                                   │
│  [p]  therapistRoster.page.subtitle                                │
│                       [Button primary: + therapistRoster.action.addTherapist] │
├────────────────────────────────────────────────────────────────────┤
│  FilterBar                                                         │
│  [Active]  [Deactivated]  [All]                                    │
├────────────────────────────────────────────────────────────────────┤
│  List — role="list" aria-label={t('therapistRoster.list.label')}  │
│                                                                    │
│  TherapistRow (one per therapist):                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  [Avatar sm, 32×32, rounded-full — photo or initials]          │ │
│  │  [Name — text-base font-medium text-neutral-800]             │ │
│  │  [Role — text-sm text-neutral-500]                           │ │
│  │  [StatusPill — only shown on "All" and "Deactivated" views]  │ │
│  │                              [Edit btn (ghost icon)]         │ │
│  │                              [Deactivate btn (ghost icon)]   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  (rows separated by border-b border-neutral-100)                  │
└────────────────────────────────────────────────────────────────────┘
```

**TherapistRow layout (desktop):** A horizontal flex row. Left: Avatar + name/role text stack. Right: action buttons. `items-center justify-between`. Padding: `py-3`.

**Avatar in list row:** Use `<Avatar name={therapist.name} src={therapist.photoUrl} size="sm" />`. The `sm` size renders at 32px (`h-8 w-8`). When no photo: `brand.100` bg, `brand.700` initials text. When photo exists: circular crop via `object-cover`. See `docs/design/components/Avatar.md` for full spec including initials derivation logic.

**Action buttons (Active therapist row):**
- Edit: ghost icon button, Lucide `Pencil` icon (size 18), `aria-label={t('therapistRoster.action.edit', {name})}`
- Deactivate: ghost icon button, Lucide `UserMinus` icon (size 18), `aria-label={t('therapistRoster.action.deactivate', {name})}`, `text-danger-500 hover:text-danger-700 hover:bg-danger-50`

**Action buttons (Deactivated therapist row):**
- Reactivate: ghost icon button, Lucide `UserCheck` icon (size 18), `aria-label={t('therapistRoster.action.reactivate', {name})}`, `text-success-500 hover:text-success-700 hover:bg-success-50`
- No Edit button for deactivated therapists in v1.

### Tablet (768–1023px)

Same as desktop. Container padding reduces to `px-6`. No structural changes needed at this breakpoint.

### Mobile (375–767px)

- PageHeader: title stacks above button; button full-width.
- FilterBar: tabs scroll horizontally if needed (unlikely with 3 short labels, but `overflow-x-auto` on the container).
- TherapistRow: avatar and name/role stack as a flex row, but action buttons move to a new row below or to a `...` overflow menu (for v1: keep both buttons visible below the name row, full-width-ish). Row becomes `flex-col gap-2`.
  - Row line 1: avatar + name + role (horizontal)
  - Row line 2: action buttons aligned right

---

## 5. Add / Edit Therapist Modal (Form)

The `ConfirmationDialog` component is used in "form mode" — the body slot contains a form instead of a plain message. The same dialog component handles all modal UIs across this feature wave, keeping focus-trap, Escape handling, and backdrop consistent.

```
┌── ConfirmationDialog ─────────────────────────────────────────────┐
│  [X close button — top-right corner]                               │
│                                                                    │
│  [h3] therapistRoster.modal.add.title / therapistRoster.modal.edit.title │
│                                                                    │
│  ── Avatar upload area (centered, above form fields) ───────────  │
│                                                                    │
│  [Avatar lg, 96px — photo or initials, centered]                   │
│  [if no photo: Button ghost/sm: therapistRoster.avatar.uploadPhoto]│
│  [if no photo: p helper: therapistRoster.avatar.fileHint]          │
│  [if photo:   Button ghost/sm: therapistRoster.avatar.replacePhoto]│
│               [Button ghost/sm danger: therapistRoster.avatar.removePhoto] │
│  [upload error message if any — role="alert"]                      │
│  [hidden file input, sr-only]                                      │
│                                                                    │
│  ── Form ──────────────────────────────────────────────────────── │
│                                                                    │
│  [label] therapistRoster.field.name.label *                        │
│  [input text, full-width]                                          │
│  [error if invalid]                                                │
│                                                                    │
│  [label] therapistRoster.field.role.label *                        │
│  [input text, full-width]                                          │
│  [error if invalid]                                                │
│                                                                    │
│  [label] therapistRoster.field.phone.label                         │
│  [input tel, full-width]                                           │
│                                                                    │
│  [label] therapistRoster.field.email.label                         │
│  [input email, full-width]                                         │
│                                                                    │
│  [label] therapistRoster.field.notes.label                         │
│  [helper: therapistRoster.field.notes.helper (500 char max)]       │
│  [textarea, rows=3, full-width]                                    │
│  [char count: {count}/500]                                         │
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: common.button.cancel]   [Button primary: common.button.save] │
└────────────────────────────────────────────────────────────────────┘
```

**Avatar upload area layout:** `flex flex-col items-center gap-2 pb-4 border-b border-neutral-100 mb-4`. This visually separates the photo section from the text fields below. The "Therapist photo" section does not have a `<label>` — the upload button itself is labeled (`therapistRoster.avatar.uploadPhoto`). A visually-present section label (`therapistRoster.avatar.sectionLabel`) is optional; omit it in v1 to keep the modal compact.

**Modal scroll:** Because the avatar upload area adds ~120px of height to the form, the modal body uses `flex-1 overflow-y-auto` per the ConfirmationDialog spec. The full form (including the avatar area) is scrollable on small viewports. The modal header and footer remain sticky.

**Modal width:** `max-w-lg` (512px) centered. On mobile: `w-full mx-4` (full-width with 16px margins).

**Field details:**

| Field | Type | Required | Max | Validation |
|---|---|---|---|---|
| Name | text | Yes | 120 | Non-empty after trim |
| Role | text | Yes | 80 | Non-empty after trim |
| Phone | tel | No | — | Optional; format hint only |
| Email | email | No | — | Optional; email format if provided |
| Notes | textarea | No | 500 | Max 500 chars |

**Required field indicator:** Asterisk `*` after the label, plus `aria-required="true"` on the input. A visually-hidden note at the top of the form: `common.form.requiredNote` ("Fields marked * are required").

---

## 6. Deactivation Confirmation Dialog

```
┌── ConfirmationDialog (destructive) ───────────────────────────────┐
│  [X close button]                                                  │
│                                                                    │
│  [AlertTriangle icon — text-warning-500, size 24]                  │
│  [h3] therapistRoster.deactivate.title ({name})                    │
│                                                                    │
│  [p] therapistRoster.deactivate.body                               │
│  [p class="mt-2 text-sm font-medium text-warning-700              │
│     bg-warning-50 rounded-lg p-3"]                                 │
│  therapistRoster.deactivate.warning  (ALWAYS shown, no API-gate)  │
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: common.button.cancel]                          │
│  [Button destructive: therapistRoster.action.deactivateConfirm]    │
└────────────────────────────────────────────────────────────────────┘
```

**Warning box** is always rendered — it is not conditional on a future-bookings API response (gate decision). It uses `warning.50` bg with `warning.700` text and a `warning.500` left border to draw the eye without being alarming.

---

## 7. Reactivation Confirmation Dialog

```
┌── ConfirmationDialog (neutral) ───────────────────────────────────┐
│  [X close button]                                                  │
│                                                                    │
│  [h3] therapistRoster.reactivate.title ({name})                    │
│  [p] therapistRoster.reactivate.body                               │
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: common.button.cancel]                          │
│  [Button primary: therapistRoster.action.reactivateConfirm]        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Empty / Error / Loading States

### Loading (list fetch)

Skeleton list — 3 rows:

```
[per row, aria-hidden="true"]
  LoadingSkeleton height="2rem" width="2rem" rounded="full"  ← avatar (32px, matches Avatar sm)
  [col] LoadingSkeleton height="1rem" width="160px"          ← name
        LoadingSkeleton height="0.875rem" width="100px" mt-1 ← role
  LoadingSkeleton height="2rem" width="64px" ml-auto         ← action buttons area
```

Container: `aria-busy="true" aria-label={t('therapistRoster.loading')} aria-live="polite"`.

### Empty — Active filter (no active therapists yet)

```
[centered, py-16]
[Users icon, Lucide, size=48, text-neutral-300]
[p] therapistRoster.empty.active.title  — text-lg font-medium text-neutral-500
[p] therapistRoster.empty.active.body   — text-sm text-neutral-400 mt-2
[Button primary: therapistRoster.action.addTherapist, mt-6]
```

### Empty — Deactivated filter (no deactivated therapists)

```
[centered, py-16]
[UserCheck icon, Lucide, size=48, text-neutral-300]
[p] therapistRoster.empty.deactivated.title
[p] therapistRoster.empty.deactivated.body
(no CTA — no action to take here)
```

### Empty — All filter (truly no therapists at all)

Same as Active empty state — same copy and CTA.

### Load error

```
[danger.50 bg, danger.500 left-border, p-6, rounded-lg]
[AlertCircle icon, text-danger-500]
[therapistRoster.loadError.title — font-medium text-neutral-700]
[therapistRoster.loadError.body — text-sm text-neutral-500 mt-1]
[Button secondary: common.button.retry, mt-4]
```

### Save error (modal stays open)

Toast `variant="error"` fires. Field-level errors appear inline if API provides them. Modal stays open. Loading state resolves.

---

## 9. Copy Keys

| Key | es | en |
|---|---|---|
| `therapistRoster.page.title` | Terapeutas | Therapists |
| `therapistRoster.page.subtitle` | Gestiona el equipo de tu estudio | Manage your studio team |
| `therapistRoster.action.addTherapist` | Agregar terapeuta | Add therapist |
| `therapistRoster.action.edit` | Editar {name} | Edit {name} |
| `therapistRoster.action.deactivate` | Desactivar {name} | Deactivate {name} |
| `therapistRoster.action.deactivateConfirm` | Sí, desactivar | Yes, deactivate |
| `therapistRoster.action.reactivate` | Reactivar {name} | Reactivate {name} |
| `therapistRoster.action.reactivateConfirm` | Sí, reactivar | Yes, reactivate |
| `therapistRoster.modal.add.title` | Agregar terapeuta | Add therapist |
| `therapistRoster.modal.edit.title` | Editar terapeuta | Edit therapist |
| `therapistRoster.field.name.label` | Nombre completo | Full name |
| `therapistRoster.field.name.error.required` | El nombre es obligatorio | Name is required |
| `therapistRoster.field.role.label` | Rol o especialidad | Role or specialty |
| `therapistRoster.field.role.error.required` | El rol es obligatorio | Role is required |
| `therapistRoster.field.phone.label` | Teléfono | Phone |
| `therapistRoster.field.email.label` | Correo electrónico | Email |
| `therapistRoster.field.notes.label` | Notas internas | Internal notes |
| `therapistRoster.field.notes.helper` | Máximo 500 caracteres. Solo visibles para el estudio. | Maximum 500 characters. Only visible to the studio. |
| `therapistRoster.field.notes.charCount` | {count}/500 | {count}/500 |
| `therapistRoster.deactivate.title` | ¿Desactivar a {name}? | Deactivate {name}? |
| `therapistRoster.deactivate.body` | El terapeuta no aparecerá en nuevas reservas. | The therapist will no longer appear in new bookings. |
| `therapistRoster.deactivate.warning` | Este terapeuta puede tener reservas próximas. Revisa tu agenda antes de desactivarlo. | This therapist may have upcoming bookings. Check your schedule before deactivating. |
| `therapistRoster.reactivate.title` | ¿Reactivar a {name}? | Reactivate {name}? |
| `therapistRoster.reactivate.body` | El terapeuta volverá a estar disponible para nuevas reservas. | The therapist will become available for new bookings again. |
| `therapistRoster.filter.active` | Activos | Active |
| `therapistRoster.filter.deactivated` | Desactivados | Deactivated |
| `therapistRoster.filter.all` | Todos | All |
| `therapistRoster.list.label` | Lista de terapeutas | Therapist list |
| `therapistRoster.status.active` | Activo | Active |
| `therapistRoster.status.deactivated` | Desactivado | Deactivated |
| `therapistRoster.loading` | Cargando terapeutas | Loading therapists |
| `therapistRoster.empty.active.title` | No hay terapeutas activos | No active therapists |
| `therapistRoster.empty.active.body` | Agrega tu primer terapeuta para comenzar | Add your first therapist to get started |
| `therapistRoster.empty.deactivated.title` | Sin terapeutas desactivados | No deactivated therapists |
| `therapistRoster.empty.deactivated.body` | Los terapeutas desactivados aparecerán aquí | Deactivated therapists will appear here |
| `therapistRoster.loadError.title` | No se pudo cargar la lista | Could not load the list |
| `therapistRoster.loadError.body` | Ocurrió un error al obtener los terapeutas. | An error occurred while loading therapists. |
| `common.form.requiredNote` | Los campos marcados con * son obligatorios | Fields marked * are required |
| `therapistRoster.avatar.label` | Foto de {name} | Photo of {name} |
| `therapistRoster.avatar.uploadPhoto` | Subir foto | Upload photo |
| `therapistRoster.avatar.replacePhoto` | Reemplazar foto | Replace photo |
| `therapistRoster.avatar.removePhoto` | Eliminar foto | Remove photo |
| `therapistRoster.avatar.fileHint` | PNG, JPG o WebP. Máximo 2 MB. Se recomienda formato cuadrado (1:1). | PNG, JPG, or WebP. Maximum 2 MB. Square format (1:1) recommended. |
| `therapistRoster.avatar.fileInput.label` | Seleccionar foto del terapeuta | Select therapist photo |
| `therapistRoster.avatar.uploading` | Subiendo foto... | Uploading photo... |
| `therapistRoster.avatar.error.fileType` | Tipo de archivo no válido. Usa PNG, JPG o WebP. | Invalid file type. Use PNG, JPG, or WebP. |
| `therapistRoster.avatar.error.fileSize` | El archivo es demasiado grande. El máximo es 2 MB. | File is too large. Maximum size is 2 MB. |
| `therapistRoster.avatar.error.uploadFailed` | No se pudo subir la foto. Intenta de nuevo. | Could not upload the photo. Please try again. |
| `therapistRoster.avatar.removePhoto.undoTitle` | Foto eliminada | Photo removed |
| `therapistRoster.avatar.removePhoto.undoDescription` | La foto se eliminará al guardar. | The photo will be removed when you save. |
| `therapistRoster.avatar.removePhoto.undoAction` | Deshacer | Undo |

---

## 10. Design Tokens Used

No new tokens introduced.

- **Colors:** Same palette as studio profile. `brand.100` + `brand.700` for Avatar initials (confirmed passing at ~6.2:1). `neutral.200` for Avatar skeleton during upload. `danger.50` + `danger.500` + `danger.700` for deactivate action and Remove photo button hover. `success.50` + `success.500` + `success.700` for reactivate action. `warning.50` + `warning.500` + `warning.700` for deactivation warning box. `neutral.100` (row dividers, avatar area separator).
- **Typography:** `text-base font-medium` (therapist name), `text-sm` (role, labels), `text-sm font-semibold` (avatar initials).
- **Spacing:** `py-3` (row padding), `gap-3` (row flex gap).
- **Border radius:** `rounded-full` (avatar), `rounded-lg` (modal, cards, buttons).
- **Shadow:** `shadow-lg` (modal), `shadow-sm` (list card if used).
- **Z-index:** Modal overlay `z-[200]`, backdrop `z-[190]`.

---

## 11. Interaction and Motion

- **Modal open:** Fade in + scale from 95% to 100%, `250ms ease-out`. Backdrop fades in `150ms`. `motion-safe:` gates all animation.
- **Modal close:** Scale to 95% + fade out, `150ms ease-in`. Backdrop fades out.
- **Row hover:** `bg-neutral-50` background transition, `150ms ease-out`. Subtle; not a card lift.
- **Action button hover:** Color change only — `motion-safe:transition-colors motion-safe:duration-150`.
- **Filter tab switch:** Instant (no animation needed for such small state change).
- **Toast:** See `Toast.md`.

---

## 12. Accessibility Checklist

- [x] Keyboard reachable — list rows navigable via Tab; action buttons reachable; Filter tabs keyboard-accessible; modal receives focus on open; upload/replace/remove buttons in modal keyboard-reachable; hidden file input accessible via `sr-only` (not `display:none`)
- [x] Focus visible — all buttons use standard focus ring
- [x] Color contrast — status pill, warning box, avatar initials (`brand.700` on `brand.100` ~6.2:1) all use passing token pairs
- [x] Screen reader labels — row action buttons have `aria-label` with therapist name; list has `role="list"` with `aria-label`; modal has `role="dialog"` with `aria-labelledby` pointing to dialog title; Avatar wrapper has `role="img"` with `aria-label={name}`; Avatar `<img>` has `alt=""`; initials span is `aria-hidden="true"`
- [x] No information conveyed by color alone — status shown as text pill ("Active" / "Deactivated"), not color dot alone; deactivate button has icon AND label; photo presence communicated by visible photo vs initials, not color
- [x] Form errors announced — `aria-invalid="true"` + `aria-describedby` on invalid fields; focus moves to first invalid field on submit; upload errors announced via `role="alert"` (no focus movement needed — auto-announced)
- [x] Focus trap in modal — Tab cycles within modal only; Escape closes modal; focus returns to trigger on close
- [x] ConfirmationDialog keyboard — initial focus on first form field in Add/Edit mode; initial focus on Cancel in destructive confirmation mode
- [x] Remove photo undo toast — standard Toast accessibility applies; undo action button in toast is keyboard-reachable

---

## 13. Responsive Notes

**Desktop (≥1024px):** Row layout horizontal, actions on right. Avatar `sm` (32px) in rows. Modal `max-w-lg` with `lg` (96px) Avatar at top of form.

**Tablet (768–1023px):** No structural changes. Modal fills up to 90% viewport width. Avatar sizes unchanged.

**Mobile (375–767px):**
- Rows: flex-col. Avatar + name/role on line 1 (horizontal), action buttons on line 2 (right-aligned). Avatar `sm` (32px) unchanged.
- Modal: `fixed inset-x-4 top-[10vh]`. Avatar `lg` (96px) centered at top. Upload/Replace/Remove buttons below avatar — use `flex-wrap gap-2 justify-center` so they wrap if needed at narrow widths. Modal body scrollable (`flex-1 overflow-y-auto`) because the avatar area adds height.
- Action buttons in rows: ensure `min-h-[44px]` for touch targets.
- FilterBar: horizontal scroll container (`overflow-x-auto`), tabs do not wrap.
- Upload button touch target: `min-h-[44px]` on the ghost button.

---

## 14. Open Questions

1. **Edit for deactivated therapists:** Spec says no Edit for deactivated therapists in v1. Confirm this is intentional — a studio owner cannot edit a deactivated therapist's details without reactivating first.
2. **Therapist count cap:** Spec says designed for ≤15 therapists / no pagination. If a studio has 20+, the list will simply be long. Confirm this is acceptable for v1.
3. **Email / phone on the row:** Should the list row show contact info, or just name + role? Current spec shows name + role only. Confirm.
4. **Sort order:** Active list — alphabetical by name? Or creation order? Spec does not specify.
5. **Photo storage bucket:** Architecture for the Supabase Storage bucket (bucket name, RLS policy: owner-only write, public-read URL structure) is an architect concern. Designer assumes public-read URLs are available for display. Architect to confirm bucket name and whether a signed URL or public URL is used for display.
6. **Avatar size in list row:** Component spec standardizes on `sm` = 32px. Original draft showed `h-10 w-10` (40px). Current spec uses 32px. Confirm the 32px size is acceptable — if 40px is strongly preferred, a `xs` variant can be added to Avatar without design impact.
