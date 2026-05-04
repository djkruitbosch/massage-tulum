# Component: PendingApprovalState

**Used in:** Studio Owner Authentication (CU-869d29f1f) — dashboard stub
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

A full-page informational state shown inside the dashboard when an authenticated user has no associated `studio_profiles` row (i.e., they are pending admin approval). Replaces all studio management content with a friendly, non-alarming explanation. The user can still log out. This is a Server Component — no interactive state needed beyond the logout button.

---

## Anatomy

```
┌────────────────────────────────────────────────────────────────────┐
│  DASHBOARD PAGE (LayoutShell with UserMenu in header)              │
├────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50                                               │
│                                                                    │
│   ┌─── max-w-[640px] mx-auto px-4 py-16 ───────────────────────┐  │
│   │                                                             │  │
│   │  ┌── bg-warning-50 border border-warning-500 rounded-2xl   │  │
│   │  │   shadow-sm p-8 ──────────────────────────────────────┐ │  │
│   │  │                                                        │ │  │
│   │  │  [Clock icon, 32px, text-warning-500, mx-auto,        │ │  │
│   │  │   aria-hidden="true"]                                  │ │  │
│   │  │                                                        │ │  │
│   │  │  Tu estudio está en revisión                          │ │  │
│   │  │  (h1, font-heading, text-xl font-semibold,            │ │  │
│   │  │   text-warning-700, text-center, mt-4)                │ │  │
│   │  │                                                        │ │  │
│   │  │  Estamos revisando tu solicitud. Te enviaremos        │ │  │
│   │  │  un correo cuando tu estudio sea aprobado.            │ │  │
│   │  │  (text-sm text-warning-700, text-center, mt-3,        │ │  │
│   │  │   max-w-xs mx-auto)                                   │ │  │
│   │  │                                                        │ │  │
│   │  │  [ Cerrar sesión — Button secondary/md fullWidth,     │ │  │
│   │  │    mt-6 ]                                              │ │  │
│   │  │                                                        │ │  │
│   │  └────────────────────────────────────────────────────────┘ │  │
│   └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Props

```typescript
interface PendingApprovalStateProps {
  locale: string; // 'es' | 'en'
  // No additional props needed — the message is generic and does not
  // reference the user's email or studio name (no studio profile exists yet).
}
```

---

## States

### Default (only state)

This component has a single state. It is always shown the same way. There is no loading state, error state, or interactive state beyond the logout button.

**Visual description:**
- Outer container: `max-w-[640px]` centered in the page main area, with `py-16` top padding to optically center the card vertically on most viewports.
- Card: `bg-warning-50 border border-warning-500 rounded-2xl shadow-sm p-8`.
- Icon: `Clock` from Lucide, `size={32}`, `text-warning-500`, displayed as `block mx-auto`, `aria-hidden="true"`.
- Heading (`<h1>`): `text-xl font-semibold text-warning-700 text-center mt-4`. Uses `<h1>` because this is the primary heading of the page when the pending state is shown — there is no other page heading in this state.
- Body: `text-sm text-warning-700 text-center mt-3 max-w-xs mx-auto`. Line length capped at `max-w-xs` (320px) for comfortable reading.
- Logout Button: `variant="secondary" size="md" fullWidth={true}`, `mt-6`. Triggers the local sign-out Server Action.

### Hover (logout button)

Standard Button secondary hover state: `bg-brand-50 border-brand-400`. No changes to the card itself.

### Loading (logout button clicked)

The logout Button enters `loading={true}` state. The card content is unchanged.

---

## Variants

This component has no visual variants. The pending state is always the warning-toned card described above.

A future "rejected" state could be designed if the product decides to show rejected users a different message instead of redirecting them entirely. That is out of scope for v1.

---

## Accessibility

- **ARIA role:** No special ARIA role needed beyond the semantic HTML. The `<h1>` is the page heading. The card is a `<div>` (not a landmark).
- **Color and icon:** The warning state is communicated by both the warning color palette AND the `Clock` icon. Color is not the sole differentiator.
- **Icon:** `aria-hidden="true"` — the heading and body text provide the full meaning.
- **Logout button:** Standard Button accessibility. The button's label "Cerrar sesión / Log out" is unambiguous. No `aria-describedby` needed.
- **Screen reader experience:** Screen reader user navigates to the page, hears the page heading "Tu estudio está en revisión / Your studio is under review", then the body copy, then the logout button. This is a clear, linear reading order.
- **No focus management needed:** This is a server-rendered page, not a modal or transitional state. Normal page focus behavior applies (focus starts at the top of the page or the first focusable element).

---

## Responsive Behavior

**Desktop (≥1024px):**
- Card is `max-w-[640px]` centered. `py-16` creates sufficient vertical breathing room.
- `p-8` card padding.

**Tablet (768–1023px):**
- Same layout. Container padding reduces with breakpoint rules.

**Mobile (375–767px):**
- Card: `mx-4` margin, fills width within those margins. Card padding reduces to `p-5`.
- The `max-w-xs` on the body text still applies (it is well within the card width on mobile).
- Logout button `fullWidth` is already specified — appropriate for mobile.
- `py-8` replaces `py-16` on mobile to avoid excessive whitespace on short viewports.
- No horizontal scroll: all content flows within the container.

---

## Tokens Used

- **Colors:** `warning.50` (card background), `warning.500` (border, icon), `warning.700` (heading and body text), `neutral.50` (page background)
- **Spacing:** `p-8`, `p-5`, `mt-4`, `mt-3`, `mt-6`, `py-16`, `py-8` (mobile), `max-w-xs`
- **Typography:** `text-xl font-semibold font-heading` (heading), `text-sm` (body)
- **Border radius:** `rounded-2xl` (card)
- **Shadow:** `shadow-sm`
- **Icons:** `Clock` (Lucide, 32px, `text-warning-500`)

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `auth.dashboard.pendingApproval.title` | Tu estudio está en revisión | Your studio is under review |
| `auth.dashboard.pendingApproval.body` | Estamos revisando tu solicitud. Te enviaremos un correo cuando tu estudio sea aprobado. | We're reviewing your application. We'll email you when your studio is approved. |
| `auth.logout.button` | Cerrar sesión | Log out |

---

## Examples

### Example 1: Studio owner logs in for the first time before admin approval

The dashboard route detects: authenticated user, no `studio_profiles` row.
Renders PendingApprovalState in the LayoutShell main area.
User sees the clock card and the logout button.

### Example 2: Spanish locale

```
locale="es"
```
All copy in Spanish. Same visual treatment.

---

## Don'ts

- Don't show any studio management UI elements (booking stats, therapist lists, etc.) in this state — the user has no studio yet.
- Don't redirect the user to `/login` when they hit `/dashboard` in this state — that creates a confusing redirect loop. Show this card instead (per spec AC-25).
- Don't use a `danger` (red) color for this card — the user hasn't done anything wrong. The pending state is expected and temporary. Use `warning` (amber/orange) to communicate "not yet" rather than "something failed."
- Don't use `<h2>` for the heading — this is the primary page heading in this state (`<h1>`).
- Don't omit the logout button — the user must be able to leave even without studio access.
