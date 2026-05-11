# Design: Service Catalog

**Spec:** ClickUp Doc 8cjnt23-12352
**Ticket:** CU-869d29f21
**Date:** 2026-05-03 (updated 2026-05-03 — Gate 2 patch: duration preset picker, terminology harmonization)
**Author:** designer (agent)

---

## 1. Screens Involved

### Screen A: Service List

- **URL pattern:** `/studio/services`
- **Primary user goal:** View all services, filter by status, add new ones, and manage existing ones.
- **Layout:** `LayoutShell` + `PageHeader` + `FilterBar` + list of service rows. Max-width `container.content` (960px). No sidebar.

### Screen B: Add Service (modal)

- **URL pattern:** `/studio/services` (same page — modal overlay)
- **Primary user goal:** Create a new service record with name, optional category, description, duration, and price.
- **Layout:** `ConfirmationDialog` in form mode.

### Screen C: Edit Service (modal)

- **URL pattern:** `/studio/services` (same page — modal)
- **Primary user goal:** Update an existing service's details.
- **Layout:** Same modal as Add, pre-filled.

### Screen D: Deactivate Service (confirmation modal)

- **URL pattern:** `/studio/services` (same page — modal)
- **Primary user goal:** Confirm deactivation with optional future-bookings count warning.
- **Layout:** `ConfirmationDialog` in destructive mode.

### Screen E: Reactivate Service (confirmation modal)

- **URL pattern:** `/studio/services` (same page — modal)
- **Primary user goal:** Confirm reactivation of a deactivated service.
- **Layout:** `ConfirmationDialog` in neutral/confirm mode.

---

## 2. User Flows

### Flow A: View active services (default view)

1. Owner navigates to `/studio/services`.
2. API fetch fires. Skeleton rows appear while loading (5 rows — services lists tend to be denser than therapists).
3. List renders showing all **active** services (default filter = Active).
4. Each row shows: name, category (if set), duration, price, and action buttons (Edit, Deactivate).
5. FilterBar shows "Active | Deactivated | All" with "Active" selected.

### Flow B: Filter to see deactivated services

1. Owner clicks "Deactivated" in the FilterBar.
2. List re-renders with deactivated services only.
3. Each row shows: name, category, duration, price, a "Deactivated" status pill, and Reactivate button (no Edit for deactivated services in v1).
4. If no deactivated services: empty state for "Deactivated" filter.

### Flow C: Add a new service

1. Owner clicks `serviceCatalog.action.addService`.
2. Add modal opens. Focus moves to the Name field.
3. Owner fills in:
   - Name (required)
   - Category (optional, `CategoryCombobox`)
   - Description (optional)
   - Duration in minutes (required)
   - Base price in MXN (required)
4. Owner clicks Save.
5. Success: modal closes; focus returns to "Add Service" button; Toast success fires; new service appears at top of active list.
6. Error: Toast error fires; modal stays open; inline field errors if API returns them.

### Flow D: Edit a service

1. Owner clicks Edit icon on a service row.
2. Edit modal opens, pre-filled. Focus moves to the Name field.
3. Owner modifies and saves.
4. Same success/error behavior as Add.

### Flow E: Deactivate a service (without future-bookings count)

1. Owner clicks Deactivate on an active service row.
2. `ConfirmationDialog` opens in destructive mode.
3. Dialog shows name and a standard deactivation message.
4. If the API does not provide a future-bookings count: no count shown, standard message only.
5. Owner confirms. On success: dialog closes; Toast success fires; service disappears from Active list.

### Flow F: Deactivate a service (with future-bookings count)

1. Same as Flow E, but if the API response includes `futureBookingsCount > 0`:
2. The confirmation dialog additionally shows a warning block: `serviceCatalog.deactivate.hasBookings` with count interpolated.
3. The warning uses the same `warning.50` pattern as the therapist deactivation warning.

### Flow G: Reactivate a service

1. Owner filters to "Deactivated".
2. Owner clicks Reactivate.
3. Simple confirmation dialog. Owner confirms.
4. On success: service moves to active list; Toast fires.

---

## 3. Component Inventory

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | Existing | Page wrapper |
| `PageHeader` | New — `docs/design/components/PageHeader.md` | Title + "Add service" button |
| `FilterBar` | New — `docs/design/components/FilterBar.md` | Active / Deactivated / All segment |
| `ServiceRow` | New (inline — see §4) | List row per service |
| `StatusPill` | New — `docs/design/components/StatusPill.md` | Active / Deactivated badge |
| `DurationPicker` | New — `docs/design/components/DurationPicker.md` | Preset chip group with Custom escape hatch |
| `CategoryCombobox` | New — `docs/design/components/CategoryCombobox.md` | Prefix-match + free-text category entry |
| `ConfirmationDialog` | New — `docs/design/components/ConfirmationDialog.md` | All modals |
| `Button` | Existing | CTAs |
| `Toast` | Existing | Feedback |
| `LoadingSkeleton` | Existing | Loading rows |

---

## 4. Service List Layout

### Desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────┐
│  PageHeader                                                        │
│  [h2] serviceCatalog.page.title                                    │
│  [p]  serviceCatalog.page.subtitle                                 │
│                       [Button primary: + serviceCatalog.action.addService] │
├────────────────────────────────────────────────────────────────────┤
│  FilterBar                                                         │
│  [Active]  [Deactivated]  [All]                                    │
├────────────────────────────────────────────────────────────────────┤
│  List — role="list" aria-label={t('serviceCatalog.list.label')}   │
│                                                                    │
│  ServiceRow (one per service):                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  [Name — text-base font-medium text-neutral-800]             │ │
│  │  [CategoryPill — if category exists]                         │ │
│  │  [Duration — text-sm text-neutral-500] · [Price — text-sm]   │ │
│  │  [StatusPill — only on "All"/"Deactivated" views]            │ │
│  │                              [Edit btn (ghost icon)]         │ │
│  │                              [Deactivate btn (ghost icon)]   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  (rows separated by border-b border-neutral-100)                  │
└────────────────────────────────────────────────────────────────────┘
```

**ServiceRow layout (desktop):** Horizontal flex. Left column: name + [category pill] + [duration · price] text. Right column: action buttons. `items-center justify-between py-4`.

**Category pill:** A small `rounded` (4px) label: `bg-brand-100 text-brand-700 text-xs font-medium px-2 py-0.5`. Only shown if the service has a category. Not an interactive element.

**Duration formatting:** Display in minutes for precision. Use `serviceCatalog.duration.format` = "{n} min". If duration is a round number of hours (60, 90, 120), also show hours format: `serviceCatalog.duration.formatHours` = "{h} h {m} min" — but only for ≥60min. This formatting is a display-only concern; the stored value is always integer minutes.

**Price formatting:** Display as MXN currency. `serviceCatalog.price.format` key not needed — use JavaScript's `Intl.NumberFormat` with locale and currency. Display as "$ 1,200" (Mexican peso notation). The stored value is an integer.

**Action buttons (Active service row):**
- Edit: ghost icon button, Lucide `Pencil` (size 18), `aria-label={t('serviceCatalog.action.edit', {name})}`
- Deactivate: ghost icon button, Lucide `EyeOff` (size 18), `aria-label={t('serviceCatalog.action.deactivate', {name})}`, `text-danger-500 hover:text-danger-700 hover:bg-danger-50`

**Action buttons (Deactivated service row):**
- Reactivate: ghost icon button, Lucide `Eye` (size 18), `aria-label={t('serviceCatalog.action.reactivate', {name})}`, `text-success-500 hover:text-success-700 hover:bg-success-50`
- No Edit for deactivated services in v1.

### Tablet (768–1023px)

Same as desktop. Container padding reduces to `px-6`.

### Mobile (375–767px)

- PageHeader: title above button, button full-width.
- FilterBar: `overflow-x-auto` container. "Deactivated" label is slightly longer than the therapist roster's "Deactivated" — confirm it fits at 375px without scroll. With three tabs and short surrounding labels the three tabs should still fit; if they overflow, `overflow-x-auto` handles it.
- ServiceRow: flex-col.
  - Line 1: Name + category pill (inline).
  - Line 2: Duration · Price (text-sm, text-neutral-500).
  - Line 3: Action buttons (right-aligned, row).
- All rows padded `py-3`.

---

## 5. Add / Edit Service Modal (Form)

```
┌── ConfirmationDialog ─────────────────────────────────────────────┐
│  [X close button]                                                  │
│                                                                    │
│  [h3] serviceCatalog.modal.add.title / serviceCatalog.modal.edit.title │
│                                                                    │
│  ── Form ──────────────────────────────────────────────────────── │
│                                                                    │
│  [label] serviceCatalog.field.name.label *                         │
│  [input text, full-width]                                          │
│  [error if invalid]                                                │
│                                                                    │
│  [label] serviceCatalog.field.category.label                       │
│  [helper] serviceCatalog.field.category.helper                     │
│  [CategoryCombobox, full-width]                                    │
│                                                                    │
│  [label] serviceCatalog.field.description.label                    │
│  [textarea, rows=3, full-width]                                    │
│                                                                    │
│  ── Duration field (full-width, above price) ──────────────────── │
│  [label] ..field.duration.label *                                  │
│  [DurationPicker — preset chip group + Custom escape hatch]        │
│  [error if invalid — shown below DurationPicker]                   │
│                                                                    │
│  ── Price field (full-width, below duration) ─────────────────── │
│  [label] ..field.price.label *                                     │
│  [input number, min=0]                                             │
│  [helper] ..field.price.helper                                     │
│  [error if invalid]                                                │
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: Cancel]      [Button primary: Save]            │
└────────────────────────────────────────────────────────────────────┘
```

**Modal width:** `max-w-lg` (512px). Mobile: `w-full mx-4`.

**Field details:**

| Field | Type | Required | Validation |
|---|---|---|---|
| Name | text | Yes | Non-empty after trim, max 120 chars |
| Category | combobox | No | Owner-managed; any string ≤ 80 chars |
| Description | textarea | No | Max 500 chars |
| Duration | DurationPicker | Yes | Preset or custom integer ≥ 1, ≤ 480 |
| Base price (MXN) | number | Yes | Integer ≥ 0 (free services allowed) |

**Duration field — DurationPicker:** Replaced from free-text number input to a preset chip group. See `docs/design/components/DurationPicker.md` for full spec. Summary:

- Preset options (in order): 30, 45, 60, 75, 90, 105, 120, 150, 180 minutes. Plus "Custom…" at the end.
- Default on Add modal: **60 min** pre-selected.
- Each preset renders as a selectable chip. Selecting a chip immediately sets the duration value. Only one chip is active at a time.
- "Custom…" chip opens an additional inline input (positive integer, `min=1`, `max=480`). The input appears directly below the chip row.
- On Edit: if the service's stored duration matches a preset (e.g., 90), that preset chip is pre-selected. If it does not match any preset (e.g., 55), "Custom…" is pre-selected and the custom input shows "55".
- Validation: if "Custom…" is selected and the input is empty or less than 1: `serviceCatalog.field.duration.error.min`. If greater than 480: `serviceCatalog.field.duration.error.max`.
- The stored and display value is always integer minutes (no change to data model).

**Price input:** `type="number"` with `min="0"` `step="1"`. Prefix "MXN $" rendered as a text node to the left of the input (inside a `relative` wrapper). The prefix is decorative; the input's `aria-label` includes the currency context via `aria-describedby`.

**Layout change:** Duration and price are no longer in a two-column grid. Duration (DurationPicker) is full-width because the chip group needs horizontal space, especially for the 9 presets + Custom. Price follows below as a full-width field. On mobile this makes no layout difference; on desktop this gives DurationPicker more room to display chips without wrapping unnecessarily.

---

## 6. Deactivation Confirmation Dialog

```
┌── ConfirmationDialog (destructive) ───────────────────────────────┐
│  [X close button]                                                  │
│                                                                    │
│  [EyeOff icon — text-danger-500, size 24]                          │
│  [h3] serviceCatalog.deactivate.title ({name})                     │
│                                                                    │
│  [p] serviceCatalog.deactivate.body                                │
│                                                                    │
│  [IF futureBookingsCount > 0 — conditional block]:                 │
│  ┌── warning block ──────────────────────────────────────────────┐ │
│  │  [bg-warning-50, border-l-4 border-warning-500, p-3 rounded]  │ │
│  │  [AlertTriangle, text-warning-500, size 16]                   │ │
│  │  [serviceCatalog.deactivate.hasBookings ({count})]            │ │
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: Cancel]                                        │
│  [Button destructive: serviceCatalog.action.deactivateConfirm]     │
└────────────────────────────────────────────────────────────────────┘
```

**Difference from therapist deactivation:** The warning block is **conditional** — it only appears if the API provides `futureBookingsCount > 0`. If the API does not return a count (count = 0 or absent), the warning block is omitted. This is the gate decision from Gate 1.

---

## 7. Reactivation Confirmation Dialog

```
┌── ConfirmationDialog (neutral) ───────────────────────────────────┐
│  [h3] serviceCatalog.reactivate.title ({name})                     │
│  [p] serviceCatalog.reactivate.body                                │
│                                                                    │
│  ── Footer ──────────────────────────────────────────────────── │
│  [Button secondary: Cancel]                                        │
│  [Button primary: serviceCatalog.action.reactivateConfirm]         │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. CategoryCombobox Behavior

The CategoryCombobox is a controlled text input that:

1. On focus/input: shows a dropdown of previously-used categories that prefix-match the current input.
2. If the user types something that matches no existing category: the dropdown shows a "Create '{value}'" option at the bottom.
3. If the user types and selects nothing: leaves the field empty (no category).
4. If the user selects an existing category: it fills the input.
5. If the user types a new string and presses Enter (or clicks "Create"): that string becomes the category value.
6. If the user types and then Tab/clicks away without selecting: the typed text IS the category value (free-text entry is allowed).

**The combobox does not manage a global category list** — the list is populated from the API (previously-used categories for this studio). The API call for suggestions happens on page load (or lazily on first focus).

See `docs/design/components/CategoryCombobox.md` for full specification.

---

## 9. Empty / Error / Loading States

### Loading (list fetch)

5 skeleton rows:

```
[per row, aria-hidden="true"]
  [col] LoadingSkeleton height="1rem" width="180px"    ← name
        LoadingSkeleton height="0.75rem" width="80px" mt-1  ← category pill
        LoadingSkeleton height="0.875rem" width="140px" mt-1 ← duration + price
  LoadingSkeleton height="2rem" width="64px" ml-auto   ← action buttons
```

Container: `aria-busy="true" aria-label={t('serviceCatalog.loading')} aria-live="polite"`.

### Empty — Active filter (no active services)

```
[centered, py-16]
[Tag icon, Lucide, size=48, text-neutral-300]
[p] serviceCatalog.empty.active.title
[p] serviceCatalog.empty.active.body
[Button primary: serviceCatalog.action.addService, mt-6]
```

### Empty — Deactivated filter (no deactivated services)

```
[centered, py-16]
[CheckCircle icon, Lucide, size=48, text-neutral-300]
[p] serviceCatalog.empty.deactivated.title
[p] serviceCatalog.empty.deactivated.body
```

### Empty — All filter (truly no services)

Same as Active empty state.

### Load error

```
[danger.50 bg, danger.500 left-border, p-6, rounded-lg]
[AlertCircle icon, text-danger-500]
[serviceCatalog.loadError.title]
[serviceCatalog.loadError.body, text-sm]
[Button secondary: common.button.retry, mt-4]
```

---

## 10. Copy Keys

| Key | es | en |
|---|---|---|
| `serviceCatalog.page.title` | Catálogo de servicios | Service catalog |
| `serviceCatalog.page.subtitle` | Define los servicios que ofrece tu estudio | Define the services your studio offers |
| `serviceCatalog.action.addService` | Agregar servicio | Add service |
| `serviceCatalog.action.edit` | Editar {name} | Edit {name} |
| `serviceCatalog.action.deactivate` | Desactivar {name} | Deactivate {name} |
| `serviceCatalog.action.deactivateConfirm` | Sí, desactivar | Yes, deactivate |
| `serviceCatalog.action.reactivate` | Reactivar {name} | Reactivate {name} |
| `serviceCatalog.action.reactivateConfirm` | Sí, reactivar | Yes, reactivate |
| `serviceCatalog.modal.add.title` | Agregar servicio | Add service |
| `serviceCatalog.modal.edit.title` | Editar servicio | Edit service |
| `serviceCatalog.field.name.label` | Nombre del servicio | Service name |
| `serviceCatalog.field.name.error.required` | El nombre del servicio es obligatorio | Service name is required |
| `serviceCatalog.field.category.label` | Categoría | Category |
| `serviceCatalog.field.category.helper` | Selecciona una existente o escribe una nueva | Select an existing category or type a new one |
| `serviceCatalog.field.category.createOption` | Crear "{value}" | Create "{value}" |
| `serviceCatalog.field.category.noOptions` | Sin categorías previas | No previous categories |
| `serviceCatalog.field.description.label` | Descripción | Description |
| `serviceCatalog.field.duration.label` | Duración | Duration |
| `serviceCatalog.field.duration.unit` | min | min |
| `serviceCatalog.field.duration.error.required` | La duración es obligatoria | Duration is required |
| `serviceCatalog.field.duration.error.min` | La duración debe ser de al menos 1 minuto | Duration must be at least 1 minute |
| `serviceCatalog.field.duration.error.max` | La duración máxima es 480 minutos (8 horas) | Maximum duration is 480 minutes (8 hours) |
| `serviceCatalog.field.duration.custom` | Personalizada… | Custom… |
| `serviceCatalog.field.duration.customLabel` | Duración personalizada (minutos) | Custom duration (minutes) |
| `serviceCatalog.field.price.label` | Precio base | Base price |
| `serviceCatalog.field.price.helper` | En pesos mexicanos (MXN). Ingresa 0 para servicios gratuitos. | In Mexican pesos (MXN). Enter 0 for free services. |
| `serviceCatalog.field.price.error.required` | El precio es obligatorio | Price is required |
| `serviceCatalog.field.price.error.min` | El precio no puede ser negativo | Price cannot be negative |
| `serviceCatalog.duration.format` | {n} min | {n} min |
| `serviceCatalog.duration.formatHours` | {h} h {m} min | {h} hr {m} min |
| `serviceCatalog.deactivate.title` | ¿Desactivar "{name}"? | Deactivate "{name}"? |
| `serviceCatalog.deactivate.body` | El servicio no aparecerá disponible para nuevas reservas. | The service will no longer be available for new bookings. |
| `serviceCatalog.deactivate.hasBookings` | Este servicio tiene {count} reservas próximas. Desactivarlo no cancelará esas reservas. | This service has {count} upcoming bookings. Deactivating it will not cancel those bookings. |
| `serviceCatalog.reactivate.title` | ¿Reactivar "{name}"? | Reactivate "{name}"? |
| `serviceCatalog.reactivate.body` | El servicio volverá a estar disponible para nuevas reservas. | The service will become available for new bookings again. |
| `serviceCatalog.filter.active` | Activos | Active |
| `serviceCatalog.filter.inactive` | Desactivados | Deactivated |
| `serviceCatalog.filter.all` | Todos | All |
| `serviceCatalog.list.label` | Lista de servicios | Service list |
| `serviceCatalog.status.active` | Activo | Active |
| `serviceCatalog.status.inactive` | Desactivado | Deactivated |
| `serviceCatalog.loading` | Cargando servicios | Loading services |
| `serviceCatalog.empty.active.title` | No hay servicios activos | No active services |
| `serviceCatalog.empty.active.body` | Agrega tu primer servicio para comenzar | Add your first service to get started |
| `serviceCatalog.empty.deactivated.title` | Sin servicios desactivados | No deactivated services |
| `serviceCatalog.empty.deactivated.body` | Los servicios desactivados aparecerán aquí | Deactivated services will appear here |
| `serviceCatalog.loadError.title` | No se pudo cargar el catálogo | Could not load the catalog |
| `serviceCatalog.loadError.body` | Ocurrió un error al obtener los servicios. | An error occurred while loading services. |

---

## 11. Design Tokens Used

No new tokens introduced.

- **Colors:** `brand.100` + `brand.700` for category pill. `danger.*` for deactivate. `success.*` for reactivate. `warning.*` for future-bookings warning. `neutral.100` for row dividers.
- **Typography:** `text-base font-medium` (service name), `text-sm` (meta info — duration, price), `text-xs font-medium` (category pill, status pill).
- **Spacing:** `py-4` (row padding), `gap-4` (form field gap), `gap-2` (DurationPicker chip gap).
- **Border radius:** `rounded` (category pill, 4px), `rounded-lg` (modal, buttons, inputs).

---

## 12. Interaction and Motion

Identical patterns to therapist roster — see that document's §11. All modal open/close animations, row hover, and button interactions use the same tokens and `motion-safe:` guards.

**CategoryCombobox:** Dropdown opens `250ms ease-out`; closes `150ms ease-in`. List items highlight on arrow key navigation. `motion-safe:` gates all.

---

## 13. Accessibility Checklist

- [x] Keyboard reachable — list rows, action buttons, FilterBar, modal all tab-reachable
- [x] Focus visible — standard focus ring on all elements
- [x] Color contrast — all token pairs pass WCAG 2.1 AA
- [x] Screen reader labels — action buttons have `aria-label` with service name; list has `role="list"` + `aria-label`; modal is `role="dialog"` with `aria-labelledby`
- [x] No information conveyed by color alone — status shown as text pill; category shown as text chip; deactivate uses icon + text
- [x] Form errors announced — `aria-invalid` + `aria-describedby` on invalid fields; focus on first error
- [x] CategoryCombobox — `role="combobox"` with `aria-expanded`, `aria-autocomplete="list"`, `aria-controls` pointing to listbox; listbox options have `role="option"` with `aria-selected`; keyboard: Arrow Up/Down to navigate options, Enter to select, Escape to dismiss, Tab to commit current text
- [x] DurationPicker — chip group has `role="group"` with `aria-labelledby`; each chip is `<button aria-pressed>` (toggle button pattern, Tab-navigable); "Custom…" chip auto-focuses custom input on activation; custom input has `aria-label`; error message uses `role="alert"`
- [x] Focus trap in modal — Tab cycles within modal; Escape closes; focus returns to trigger

---

## 14. Responsive Notes

**Desktop (≥1024px):** Full row layout. Duration (DurationPicker chip group, full-width) above Price (full-width input) in form.

**Tablet (768–1023px):** Same as desktop. Container padding `px-6`. DurationPicker chips may wrap to a second line if the chip group is wider than the tablet modal — this is expected behavior and acceptable.

**Mobile (375–767px):**
- ServiceRow: name + category pill on line 1; duration · price on line 2; action buttons on line 3 (right-aligned).
- Form: all fields full-width (no two-column layout was used post-patch). DurationPicker chip group wraps across multiple rows naturally at 375px. CategoryCombobox dropdown opens downward; if near bottom of viewport, opens upward.
- Modal: same inset pattern as therapist roster. `fixed inset-x-4 top-[10vh]`. DurationPicker custom input (when "Custom…" selected) is full-width.

---

## 15. Open Questions

1. **Price display format:** Using `Intl.NumberFormat` for MXN — confirm whether to display as "MXN $1,200" or "$ 1,200" or "$1,200". Mexican convention varies. Design assumes "$ 1,200" (space after symbol, comma thousands separator). Confirm.
2. **Duration display for exactly 60 min / 90 min:** Spec shows format logic above. Is "1 hr 0 min" acceptable, or should it be "1 hr" (omit zero minutes)? Recommend omitting zero minutes. Confirm.
3. **Category list API call:** When is the category list fetched — on page load (eager) or on first focus of the combobox (lazy)? Recommend lazy (on focus) to avoid an extra API call on every page load. Confirm with backend.
4. **Sort order:** Active list — alphabetical or creation order? Spec does not specify.
5. **DurationPicker — custom input appearance on mobile:** When "Custom…" is selected, the custom minute input appears below the chip row. At 375px this is comfortable. Confirm the chip group wrapping behavior is acceptable — at 375px with `gap-2` chips, the 9 presets + Custom will wrap across 3–4 lines. If wrapping is not acceptable, an alternative is a `<select>` dropdown (one-line, simpler) — but that trades tap-friendliness for compactness. Current design recommends chip group (better for one-tap selection on mobile).
