# Component: PendingStudiosTable

**Used in:** Studio Owner Authentication (CU-869d29f1f) — admin review screen
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

A data table listing pending studio applications for admin review. Each row shows submission details and provides Approve and Reject actions. On mobile, converts from a table to a stacked card list. Manages its own per-row loading states and delegates modal/confirmation presentation upward (the page component owns the modals).

---

## Anatomy (Desktop Table)

```
┌──── bg-white rounded-2xl shadow-sm overflow-hidden ──────────────────────┐
│                                                                           │
│  TABLE HEADER  (bg-neutral-50 border-b border-neutral-200)               │
│  ┌──────────┬──────────────────┬─────────────────┬──────────┬──────────┐ │
│  │ Fecha    │ Correo           │ Estudio         │ Teléfono │ Acciones │ │
│  │ (text-xs │ (text-xs font-   │ (text-xs font-  │ (text-xs │ (text-xs │ │
│  │  uppercase│  medium neutral- │  medium neutral- │ uppercase│  sr-only │ │
│  │  neutral- │  500 px-4 py-3)  │  500 px-4 py-3) │ neutral- │  on md+) │ │
│  │  500)    │                  │                 │  500)    │          │ │
│  └──────────┴──────────────────┴─────────────────┴──────────┴──────────┘ │
│                                                                           │
│  ROW 1 (border-b border-neutral-100 hover:bg-brand-50)                   │
│  ┌──────────┬──────────────────┬─────────────────┬──────────┬──────────┐ │
│  │ 01/05/26 │ owner@studio.com │ Tulum Healing   │ +52 984  │ [Aprobar]│ │
│  │ (text-sm │ (text-sm truncate│ (text-sm font-  │ ...      │ [Rechazar│ │
│  │  text-   │  text-neutral-600│  medium neutral- │ (text-sm │ ]        │ │
│  │  neutral-│  max-w-[200px])  │  700 truncate)   │ neutral- │          │ │
│  │  500)    │                  │                 │  500)    │          │ │
│  ├──────────┴──────────────────┴─────────────────┴──────────┴──────────┤ │
│  │  Description row (colspan all, if description exists):              │ │
│  │  px-4 pb-3 text-sm text-neutral-500 line-clamp-2                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ROW 2 ...                                                                │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Description row:** The description field is shown in a full-width sub-row below the main data row (using a separate `<tr>` spanning all columns or a nested layout). This avoids a very wide "description" column that would compress the action buttons. The description is `line-clamp-2` with a "show more" toggle.

---

## Anatomy (Mobile Card List)

```
┌─── bg-white rounded-2xl shadow-sm p-4 mb-3 ──────────────────────────┐
│                                                                        │
│  Tulum Healing Studio                 01/05/26                        │
│  (text-base font-semibold neutral-800) (text-xs text-neutral-400)     │
│                                                                        │
│  owner@studio.com                                                      │
│  (text-sm text-neutral-500)                                            │
│                                                                        │
│  +52 984 000 0000  (text-sm neutral-500, if present)                  │
│                                                                        │
│  Servicios que ofrece: terapias de masaje...  [Ver más]               │
│  (text-sm text-neutral-600, line-clamp-2)     (text-xs link brand-600)│
│                                                                        │
│  [ Aprobar — Button primary/md fullWidth ]                            │
│  [ Rechazar — Button secondary/md fullWidth, mt-2 ]                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Props

```typescript
interface PendingStudiosTableProps {
  applications: PendingStudioApplication[];
  locale: string; // 'es' | 'en'
  // Callbacks are passed from the page component which owns the modal state
  onApprove: (applicationId: string, studioName: string) => void;
  onReject: (applicationId: string, studioName: string) => void;
}

interface PendingStudioApplication {
  id: string;
  submittedAt: string;       // ISO 8601 date string
  email: string;
  studioName: string;
  contactPhone: string | null;
  description: string;
  // status is always 'pending' in this view — if approved/rejected,
  // the row should not be in this list
}
```

The `onApprove` and `onReject` callbacks receive the `applicationId` and `studioName` so the page can open the appropriate confirmation modal with the studio name pre-populated in the modal copy.

---

## States

### Default (data loaded, rows present)

Standard table with alternating subtle hover on rows. All Approve and Reject buttons are enabled.

### Row — Default (not hovered, not loading)

```
border-b border-neutral-100
bg-white
```

### Row — Hover

```
bg-brand-50
motion-safe:transition-colors motion-safe:duration-100 motion-safe:ease-out
```

### Row — Action Loading (approve or reject clicked, modal confirmed, Server Action in flight)

While the Server Action is executing for a specific row:
- Approve button on that row: `loading={true}`, label → "Aprobando... / Approving..."
- Reject button on that row: `disabled={true}`, `opacity-50 cursor-not-allowed`
- No other rows are affected.

If the action fails (API error), the row returns to its default state and a Toast error appears.

### Row — Success (row disappears)

On successful approve or reject, the row animates out of the table:
- `motion-safe:animate-[fadeOut_200ms_ease-in_forwards]`
- After animation completes, the row is removed from the DOM.

Reduced motion: row disappears instantly without animation.

### Empty State

When `applications.length === 0`, the table area is replaced by:

```
┌─── bg-white rounded-2xl shadow-sm p-12 text-center ──────────────────┐
│                                                                        │
│  [ClipboardCheck icon, 48px, text-neutral-300, mx-auto,               │
│   aria-hidden="true"]                                                  │
│                                                                        │
│  No hay solicitudes pendientes.                                        │
│  (text-base text-neutral-500, mt-4)                                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

No CTA in the empty state — there is nothing actionable when the queue is empty.

### Loading State (initial data fetch)

While the applications are being fetched (during the initial page load), show 3 skeleton table rows. Each skeleton row mimics the visual structure of a real row:

```
<div aria-busy="true" aria-label={t('admin.pendingStudios.loading')} aria-live="polite">
  {[1,2,3].map(i => (
    <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-neutral-100">
      <LoadingSkeleton height="1rem" width="80px" />    // date
      <LoadingSkeleton height="1rem" width="180px" />   // email
      <LoadingSkeleton height="1rem" width="140px" />   // studio name
      <LoadingSkeleton height="1rem" width="100px" />   // phone
      <div className="ml-auto flex gap-2">
        <LoadingSkeleton height="2.5rem" width="80px" />  // approve btn
        <LoadingSkeleton height="2.5rem" width="80px" />  // reject btn
      </div>
    </div>
  ))}
</div>
```

---

## Table Column Specification

| Column | Desktop width | Tablet width | Mobile | Content |
|---|---|---|---|---|
| Fecha / Date | `w-24` (96px) | `w-20` | Hidden (shown in card header) | `submittedAt` formatted as `DD/MM/YY` in `es`, `MM/DD/YY` in `en`. Full ISO date in `title` attribute for tooltip. |
| Correo / Email | `min-w-[180px] max-w-[220px]` | `max-w-[160px]` | Below studio name | `email`, truncated with `truncate`. Full email in `title` attribute. |
| Estudio / Studio | `min-w-[140px] max-w-[200px]` | `max-w-[140px]` | Card heading | `studioName`, truncated. |
| Teléfono / Phone | `w-32` | Hidden (`hidden md:table-cell`) | Below email if present | `contactPhone`, or `—` if null. |
| Acciones / Actions | `w-[160px]` | `w-[140px]` | Full-width buttons below description | Approve + Reject buttons. |
| Description | Full-width sub-row | Same | Below phone in card | `description`, `line-clamp-2`. |

**Actions column header:** The "Acciones / Actions" column header text is visually hidden on desktop (`sr-only`) because the buttons themselves communicate the action. The header is still in the DOM for screen reader table navigation.

---

## Action Buttons (in table row)

**Approve button:**
```
variant="primary" size="sm"
children={t('admin.pendingStudios.actions.approve')}
onClick={() => onApprove(application.id, application.studioName)}
```

**Reject button:**
```
variant="ghost" size="sm"
children={t('admin.pendingStudios.actions.reject')}
onClick={() => onReject(application.id, application.studioName)}
```

The Reject button uses `ghost` variant (lower visual weight than secondary) because it is a destructive/negative action that should not compete with the primary Approve action.

On mobile cards, both buttons become `md` size and `fullWidth`.

---

## Description Expand/Collapse

The description is initially `line-clamp-2` (2 lines, then "..." ellipsis). A "[Ver más / Show more]" inline text link toggles to show the full description. The link text changes to "[Ver menos / Show less]" when expanded.

This is a simple client-side toggle on the row. No animation needed (the height change is instantaneous). The "show more/less" toggle is `role="button"` or a plain `<button>` with `tabIndex={0}`.

---

## Variants

**No explicit variants.** The desktop table and mobile card list are responsive layouts of the same component, not separate variants.

---

## Accessibility

- **Table structure:** Use proper `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` elements on desktop. This enables screen readers to announce column headers for each cell.
- **`<th scope="col">`:** All column headers use `scope="col"` for proper table navigation.
- **Empty cell (phone null):** Display `—` (em dash, U+2014) as the content. `aria-label="Sin teléfono / No phone"` on the `<td>` to avoid the screen reader reading "dash" unhelpfully.
- **Loading state:** `aria-busy="true"` and `aria-live="polite"` on the container wrapping skeleton rows.
- **Empty state:** The empty state `<div>` is in the same DOM position as the table — no ARIA role changes needed.
- **Row actions:** Each row's Approve and Reject buttons have accessible names. Since multiple rows have buttons with the same label ("Approve"), add `aria-label` that includes the studio name: `aria-label={t('admin.pendingStudios.actions.approve') + ': ' + application.studioName}`. This prevents "Approve, Approve, Approve" being read without context.
- **Description expand/collapse:** The toggle button has `aria-expanded` (true/false) and `aria-controls` pointing to the description element's `id`.
- **Row removal animation:** When a row is removed after action, the DOM removal fires immediately if `prefers-reduced-motion` is set. Otherwise the brief fade animation plays before removal. Screen readers do not need special handling — the DOM removal removes the row from the accessibility tree.

---

## Responsive Behavior

**Desktop (≥1024px):**
- Full table with all columns. Actions column has two side-by-side `sm` buttons.
- Description in a sub-row below each data row.
- Approve/Reject column is last, right-aligned.

**Tablet (768–1023px):**
- Phone column is hidden (`hidden md:table-cell` shows it, so add `hidden lg:table-cell` to hide on tablet).
- Description still in sub-row.
- Buttons remain `sm` size but the column is narrower.

**Mobile (<768px):**
- Table → stacked card layout. Each `PendingStudioApplication` renders as a card.
- The `<table>` is not rendered at all on mobile (conditional render based on viewport, not CSS hide — to avoid the accessibility confusion of a hidden table).
- Developer-fe implements with a responsive conditional: show `<table>` at `≥md`, show card list at `<md`. The data mapping is the same; only the markup structure changes.

---

## Tokens Used

- **Colors:** `brand.50` (row hover), `neutral.50` (table header bg), `neutral.100` (row border), `neutral.200` (table container border), `neutral.300` (empty state icon), `neutral.400` (date text, phone text), `neutral.500` (empty state text, muted labels), `neutral.600` (email text), `neutral.700` (studio name), `neutral.800` (mobile card heading), `brand.600` (description expand link)
- **Spacing:** `px-4 py-4` (row cells), `px-4 py-3` (header cells), `p-4` (mobile card), `p-12` (empty state), `mb-3` (mobile card gap)
- **Typography:** `text-xs uppercase font-medium` (column headers), `text-sm` (cell content), `text-base font-semibold` (mobile card heading)
- **Border radius:** `rounded-2xl` (container card, mobile item card)
- **Shadow:** `shadow-sm`
- **Motion:** `duration-100 ease-out` (row hover), `200ms ease-in` (row exit)

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `admin.pendingStudios.title` | Solicitudes pendientes | Pending applications |
| `admin.pendingStudios.count` | {count, plural, one {# solicitud} other {# solicitudes}} | {count, plural, one {# application} other {# applications}} |
| `admin.pendingStudios.empty` | No hay solicitudes pendientes. | No pending applications. |
| `admin.pendingStudios.columns.submittedAt` | Fecha | Date |
| `admin.pendingStudios.columns.email` | Correo | Email |
| `admin.pendingStudios.columns.studioName` | Estudio | Studio |
| `admin.pendingStudios.columns.contactPhone` | Teléfono | Phone |
| `admin.pendingStudios.columns.description` | Descripción | Description |
| `admin.pendingStudios.columns.actions` | Acciones | Actions |
| `admin.pendingStudios.columns.noPhone` | Sin teléfono | No phone |
| `admin.pendingStudios.actions.approve` | Aprobar | Approve |
| `admin.pendingStudios.actions.reject` | Rechazar | Reject |
| `admin.pendingStudios.actions.approveLabel` | Aprobar: {studioName} | Approve: {studioName} |
| `admin.pendingStudios.actions.rejectLabel` | Rechazar: {studioName} | Reject: {studioName} |
| `admin.pendingStudios.actions.approvingLabel` | Aprobando... | Approving... |
| `admin.pendingStudios.description.showMore` | Ver más | Show more |
| `admin.pendingStudios.description.showLess` | Ver menos | Show less |
| `admin.pendingStudios.loading` | Cargando solicitudes... | Loading applications... |
| `admin.pendingStudios.approveModal.title` | Aprobar estudio | Approve studio |
| `admin.pendingStudios.approveModal.body` | ¿Confirmas la aprobación de "{studioName}"? Se creará su cuenta y se enviará un correo de bienvenida con un enlace de acceso. | Confirm approval of "{studioName}"? Their account will be created and a welcome email with a sign-in link will be sent. |
| `admin.pendingStudios.rejectModal.title` | Rechazar solicitud | Reject application |
| `admin.pendingStudios.rejectModal.reasonLabel` | Razón (opcional) | Reason (optional) |
| `admin.pendingStudios.rejectModal.reasonPlaceholder` | Ingresa un motivo para tu registro interno... | Enter a reason for your internal records... |
| `admin.pendingStudios.rejectModal.confirmButton` | Rechazar | Reject |
| `admin.pendingStudios.toast.approveSuccess` | Estudio aprobado. Correo de bienvenida enviado. | Studio approved. Welcome email sent. |
| `admin.pendingStudios.toast.approveError` | No se pudo aprobar el estudio. Intenta de nuevo. | Could not approve the studio. Please try again. |
| `admin.pendingStudios.toast.rejectSuccess` | Solicitud rechazada. | Application rejected. |
| `admin.pendingStudios.toast.rejectError` | No se pudo rechazar la solicitud. Intenta de nuevo. | Could not reject the application. Please try again. |

---

## Examples

### Example 1: Three pending applications, desktop

```
applications={[
  { id: '1', submittedAt: '2026-05-01T10:00:00Z', email: 'owner@tulum.com',
    studioName: 'Tulum Healing Studio', contactPhone: '+52 984 000 0000',
    description: 'Ofrecemos masajes relajantes...' },
  { id: '2', submittedAt: '2026-05-02T14:00:00Z', email: 'massage@studio.com',
    studioName: 'Aqua Wellness', contactPhone: null,
    description: 'Terapias de spa y relajación...' },
  ...
]}
locale="es"
onApprove={(id, name) => openApproveModal(id, name)}
onReject={(id, name) => openRejectModal(id, name)}
```

Renders full table with 3 rows. Phone column shows `—` for the second row.

### Example 2: Empty state

```
applications={[]}
locale="en"
```

Renders the empty state card with ClipboardCheck icon and "No pending applications."

### Example 3: Row loading after approve confirmation

After the admin confirms approval for row with `id: '1'`, the `onApprove` handler fires the Server Action. The Approve button on that row enters `loading={true}`. Other rows are unaffected. On success, the row fades out and is removed.

---

## Don'ts

- Don't show all `pending_studios` entries regardless of status — only show rows with `status = 'pending'`. Approved and rejected rows are not shown in this view.
- Don't allow simultaneous actions on the same row — disable the other button while an action is in flight.
- Don't use a toast for the "no pending applications" empty state — use the inline empty state card.
- Don't use a confirmation toast instead of a confirmation modal for the approve action — the approve action is irreversible (it creates rows and sends an email) and requires deliberate confirmation.
- Don't render the `<table>` element on mobile — use conditional rendering to switch to the card list at `<768px`. A table with many columns on mobile is nearly unusable even with `overflow-x-auto`.
- Don't add pagination in v1 — at launch volume (<10 studios), all rows fit on one page. Add when the list exceeds 50 rows.
