# Component: UserMenu

**Used in:** Studio Owner Authentication (CU-869d29f1f) — dashboard and admin pages
**Designer doc:** `docs/design/CU-869d29f1f-studio-owner-auth.md`
**Status:** Spec
**Date:** 2026-05-03

---

## Purpose

A dropdown menu anchored to the authenticated user's email address in the header. Provides access to sign-out actions: local logout and global logout (all devices). Used on every authenticated page (dashboard stub, admin pages). This is a Client Component because it manages open/close state and keyboard navigation.

---

## Anatomy

### Trigger (collapsed)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER                                                  │
│  [ Massage Tulum ]   [ ES | EN ]  [ owner@studio.com ▾ ]│
│                                   ↑ UserMenu trigger    │
└─────────────────────────────────────────────────────────┘
```

The trigger is a `<button>` displaying the authenticated user's email address with a chevron icon. The email truncates on narrow viewports.

### Dropdown (expanded)

```
                            ┌───────────────────────────────┐
                            │  owner@studio.com              │
                            │  (text-sm text-neutral-500,    │
                            │   px-4 py-3, max-w truncated)  │
                            ├───────────────────────────────┤
                            │  [LogOut 16px] Cerrar sesión   │
                            │  (text-sm text-neutral-700)    │
                            ├───────────────────────────────┤
                            │  [LogOut 16px muted]           │
                            │  Cerrar en todos los           │
                            │  dispositivos                  │
                            │  (text-xs text-neutral-500)    │
                            └───────────────────────────────┘
```

The dropdown is absolutely positioned below-right of the trigger button, anchored to the right edge of the trigger.

---

## Props

```typescript
interface UserMenuProps {
  email: string;        // The authenticated user's email address
  locale: string;       // 'es' | 'en' — for translated labels
}
```

The logout actions are Server Actions. The UserMenu calls them directly — no callback props needed. The Server Action handles the redirect after sign-out.

---

## States

### Trigger — Default (closed)

```
button: bg-white or transparent (matches header bg)
        text-neutral-700 text-sm font-medium
        flex items-center gap-1.5
        rounded-lg px-2 py-1 h-9
        border border-transparent (no visible border in default state)

[ChevronDown icon: 16px, text-neutral-400]
```

The email is rendered as `<span className="max-w-[200px] truncate">` to prevent header overflow on long email addresses. On mobile, reduces to `max-w-[140px]`.

### Trigger — Hover

```
bg-neutral-100 border-neutral-200
```

### Trigger — Focus-visible

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600
```

### Trigger — Open (dropdown is visible)

```
bg-neutral-100 border-neutral-200
[ChevronDown icon]: rotated 180deg (ChevronUp visual), motion-safe:transition-transform duration-150
```

The `aria-expanded` attribute is `true` when open.

### Dropdown Container

```
position: absolute
top: calc(100% + 8px)  (8px gap below trigger)
right: 0
min-width: 220px
max-width: 320px
bg-white rounded-2xl shadow-lg border border-neutral-200
z-[60]  (above page content, below any modals at z-[100])
```

The dropdown is rendered in a portal (appended to `document.body`) to avoid overflow clipping from the header container. Developer-fe uses `Floating UI` or equivalent for positioning; the visual spec above describes the intended position.

### Email Header Row (non-interactive)

```
px-4 py-3
text-sm text-neutral-500
truncate overflow-hidden
border-b border-neutral-100
```

This row is not a menu item — it is purely informational. It is NOT focusable (`aria-hidden="true"` on the row, or rendered as a `<p>` inside a `<div>` outside the `role="menu"` context). Screen readers who need to know the email address will hear it from the trigger button's accessible name (which includes the email).

### Menu Item: Log Out (local)

```
role="menuitem"
display: flex items-center gap-2
px-4 py-2.5 text-sm text-neutral-700 font-medium
w-full text-left cursor-pointer
hover: bg-neutral-50
focus-visible: bg-neutral-50 outline-none ring-0
  (menu items use background highlight, not ring, for focus within the menu)
active: bg-neutral-100

[LogOut icon: 16px, text-neutral-500, aria-hidden="true"]
```

Clicking this item: triggers the local sign-out Server Action → redirects to `/login`.

### Menu Item: Log Out All Devices

```
role="menuitem"
display: flex items-center gap-2
px-4 py-2.5 text-xs text-neutral-500
w-full text-left cursor-pointer
border-t border-neutral-100
hover: bg-neutral-50 text-neutral-700
focus-visible: bg-neutral-50 outline-none ring-0
active: bg-neutral-100

[LogOut icon: 14px, text-neutral-400 (lighter than primary logout), aria-hidden="true"]
```

This action has lower visual weight than the primary log out:
- Smaller text (`text-xs` vs `text-sm`)
- Muted text color (`neutral.500` vs `neutral.700`)
- Smaller icon (14px vs 16px)
- Separated from the primary logout by a `border-t border-neutral-100`

Clicking this item: opens a confirmation dialog (see below).

### Loading State (while sign-out is in flight)

When either logout action is clicked and the Server Action is in flight:
- The clicked menu item shows a Loader2 spinner replacing its icon, `animate-spin text-neutral-400`.
- The other menu item is `pointer-events-none opacity-50`.
- The trigger button is `pointer-events-none` to prevent reopening.

---

## Confirmation Dialog: Log Out of All Devices

This is a modal dialog, not an inline confirmation. It appears on top of the UserMenu dropdown (which closes when the modal opens).

```
┌─── role="dialog" aria-modal="true" aria-labelledby="logout-all-title" ──┐
│  Overlay: fixed inset-0 bg-black/40 z-[90]                              │
│                                                                          │
│  ┌── Dialog: bg-white rounded-2xl shadow-lg p-6 max-w-[420px] ────────┐ │
│  │                                                                     │ │
│  │  id="logout-all-title"                                              │ │
│  │  Cerrar sesión en todos los dispositivos                            │ │
│  │  (h3, text-xl font-semibold text-neutral-800)                      │ │
│  │                                                                     │ │
│  │  Se cerrará tu sesión en todos los dispositivos donde estés        │ │
│  │  conectado. ¿Continuar?                                             │ │
│  │  (text-sm text-neutral-600 mt-2)                                   │ │
│  │                                                                     │ │
│  │  [Cancelar — Button secondary/md]  [Confirmar — Button primary/md] │ │
│  │  (flex gap-3 justify-end mt-6)                                     │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Focus management:**
1. When dialog opens: focus moves to the "Cancelar / Cancel" button (the safer default — destructive action is not the default focus).
2. Tab key cycles only between Cancel and Confirm.
3. ESC closes the dialog → focus returns to the "Log out of all devices" menu item.
4. Clicking Cancel: dialog closes → focus returns to the trigger button (menu is also closed).
5. Clicking Confirm: dialog closes, Server Action fires, user is redirected to `/login`.

---

## Keyboard Navigation (Dropdown Menu)

- `Enter` or `Space` on trigger: opens dropdown, focus moves to first menu item ("Log out").
- `ArrowDown`: moves focus to the next menu item.
- `ArrowUp`: moves focus to the previous menu item.
- `ArrowDown` on last item: wraps to first item.
- `ArrowUp` on first item: wraps to last item.
- `Enter` or `Space` on a menu item: activates the item.
- `Tab` or `Escape`: closes the dropdown and returns focus to the trigger.
- Clicking outside the dropdown: closes it and returns focus to the trigger.

This follows the WAI-ARIA Menu Button pattern.

---

## Placement in Header

The UserMenu trigger sits to the right of the LanguageSwitcher in the header right slot:

```
[ ES | EN ]  [ owner@studio.com ▾ ]
             ↑ 12px gap between items
```

Tailwind on the header right slot container:
```
flex items-center gap-3
```

On mobile (`<md`), the email truncates more aggressively (`max-w-[120px]`). The ChevronDown icon is always visible.

---

## Variants

**Standard (studio owner):** Email + local logout + global logout. This is the only variant in scope for v1.

A future `admin` variant might add an "Admin panel" link. When that feature arrives, extend by adding `role="menuitem"` items above the logout section. Do not add them now.

---

## Accessibility

- **ARIA role:** Trigger button has `aria-haspopup="menu"` and `aria-expanded` (true/false). Dropdown has `role="menu"`. Each action has `role="menuitem"`.
- **Keyboard:** Implements the WAI-ARIA Menu Button pattern (arrow keys, Escape, Enter/Space). See keyboard navigation section above.
- **Focus management:** Focus trap within the menu while open. Focus returns to trigger on close. Described in detail above.
- **Screen reader announcement for trigger:** The trigger button's accessible name should read as the email address. Since the email is visible text, this is automatic. The ChevronDown icon has `aria-hidden="true"`.
- **Email header row:** Marked `aria-hidden="true"` or rendered outside `role="menu"` to avoid confusing screen readers who expect only `menuitem` children in a `menu` context.
- **Confirmation dialog:** Standard modal accessibility (role="dialog", aria-modal, aria-labelledby, focus trap, Escape). See modal pattern in `docs/design/accessibility.md`.
- **Color alone:** The "log out all devices" item is differentiated by both visual weight (smaller text and icon, separator) AND position (last item). Color is not the only differentiator.

---

## Responsive Behavior

**Desktop (≥1024px):**
- Email truncates at `max-w-[200px]`.
- Dropdown is `min-w-[220px]` anchored right.
- Both logout items visible in full.

**Tablet (768–1023px):**
- Same as desktop. Header has enough space for logo, language switcher, and user menu.

**Mobile (375–767px):**
- Email truncates at `max-w-[120px]`. If even this causes overflow (very long email), the trigger shrinks to just a `user` Lucide icon with `aria-label={t('userMenu.trigger.label')}` — a safe fallback. Developer-fe decides whether to implement the icon fallback or always show a truncated email.
- Dropdown is full-width: `left-0 right-0 mx-4` (16px from each side). The dropdown becomes `position: fixed bottom-0` if needed to avoid it being clipped by the header.
- Confirmation dialog: full-screen overlay on mobile, `mx-4` margin on the dialog.

---

## Tokens Used

- **Colors:** `neutral.50`, `neutral.100`, `neutral.200`, `neutral.400`, `neutral.500`, `neutral.600`, `neutral.700`, `brand.600`
- **Spacing:** `px-4 py-2.5` (menu items), `px-4 py-3` (email row), `p-6` (dialog), `gap-3` (header right slot)
- **Typography:** `text-sm font-medium` (trigger, primary logout), `text-xs` (secondary logout, email row)
- **Border radius:** `rounded-lg` (trigger), `rounded-2xl` (dropdown, dialog)
- **Shadow:** `shadow-lg` (dropdown, dialog)
- **Z-index:** `z-[60]` (dropdown), `z-[90]` (modal overlay)
- **Motion:** `duration-150 ease-out` (chevron rotation, dropdown entry)

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `userMenu.trigger.label` | Menú de usuario | User menu |
| `userMenu.signedInAs` | Conectado como | Signed in as |
| `auth.logout.button` | Cerrar sesión | Log out |
| `auth.logout.allDevices` | Cerrar en todos los dispositivos | Log out of all devices |
| `auth.logout.allDevices.confirmTitle` | Cerrar sesión en todos los dispositivos | Log out of all devices |
| `auth.logout.allDevices.confirmBody` | Se cerrará tu sesión en todos los dispositivos donde estés conectado. ¿Continuar? | You'll be signed out on all devices where you're currently logged in. Continue? |
| `common.button.cancel` | Cancelar | Cancel |
| `common.button.confirm` | Confirmar | Confirm |

---

## Examples

### Example 1: Standard desktop usage

```
email="owner@tulumstudio.com"
locale="es"
```
Trigger shows "owner@tulumstudio.com ▾" (truncated if needed). Dropdown shows email header, local logout, global logout.

### Example 2: Long email on mobile

```
email="very.long.email.address@longdomainname.com"
locale="en"
```
Trigger shows "very.long.email..." with truncation. Dropdown shows full email in the header row.

---

## Don'ts

- Don't show the UserMenu on public pages (login, signup, auth callback) — it is only for authenticated pages.
- Don't put the confirmation dialog for local logout — only global logout requires confirmation (per spec OQ-5 decision).
- Don't use `aria-label` to describe the email in the header row if it is outside `role="menu"` — just render it as normal text.
- Don't use `display: none` to close the dropdown — use `aria-expanded` and conditional rendering (or `visibility: hidden` with pointer-events-none) so the keyboard can't accidentally reach hidden menu items.
- Don't let the dropdown overflow the viewport edge on narrow screens — use the full-width mobile layout described above.
