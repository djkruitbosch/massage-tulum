# Component: Toast

**Used in:** Foundation, all features (system notifications)
**Designer doc:** `docs/design/foundation-home.md`
**Status:** Spec
**Date:** 2026-04-26

---

## Purpose

A transient notification that appears at the corner of the screen to confirm an action outcome or communicate a system event. Toasts are non-blocking — the user can continue working without dismissing them. They auto-dismiss after a set duration and can also be manually dismissed.

**Use cases:** login link sent, save confirmed, error saving, network failure, info message.

---

## Anatomy

```
┌─────────────────────────────────────────────────┐
│  [Icon]  Title text                     [× ]   │
│          Optional description text              │
└─────────────────────────────────────────────────┘
```

- **Icon:** 20×20 Lucide icon indicating the variant (left-aligned)
- **Title:** Required. Short, one-line confirmation or error message.
- **Description:** Optional. One line of additional detail.
- **Dismiss button:** An `×` (Lucide `X` icon) in the top-right. Always present (not hidden even on auto-dismiss).
- **Progress bar (optional):** A thin line at the bottom of the toast that depletes over the auto-dismiss duration. Helps users understand how long the toast will persist. Defaults to shown for `success` and `info` variants. Hidden for `error` variant (error toasts require explicit dismissal).

---

## Props

```typescript
interface ToastProps {
  // Content
  title: string;                           // Required: short message
  description?: string;                    // Optional: secondary line

  // Behavior
  variant: 'success' | 'error' | 'info';  // Required
  duration?: number;                       // Auto-dismiss ms. Default: 4000. Set to 0 to disable auto-dismiss.
  onDismiss?: () => void;                  // Called when dismissed (auto or manual)

  // Accessibility
  id: string;                              // Required: unique ID for ARIA references
}
```

**Toast Manager (system-level):** The app needs a toast queue manager (a React context + zustand store, or a dedicated library like Sonner or react-hot-toast). The developer-fe chooses the library — the component spec describes the visual output, not the state management. Recommendation: Sonner (by Emil Kowalski) — it is lightweight, accessible, and produces output matching this spec.

---

## Variants

### `success`

| Property | Value |
|---|---|
| Left border | 4px solid `success.500` (`#22863A`) |
| Background | `white` |
| Icon | `CheckCircle2` (Lucide), `text-success-500` |
| Title color | `text-neutral-700` |
| Description color | `text-neutral-500` |
| Auto-dismiss | 4000ms (default) |
| Progress bar | Shown, `bg-success-500` |

**Tailwind classes:**
```
flex gap-3 items-start
rounded-lg bg-white shadow-lg border-l-4 border-success-500
p-4 min-w-[300px] max-w-[400px]
```

### `error`

| Property | Value |
|---|---|
| Left border | 4px solid `danger.500` (`#DC2626`) |
| Background | `white` |
| Icon | `AlertCircle` (Lucide), `text-danger-500` |
| Title color | `text-neutral-700` |
| Description color | `text-neutral-500` |
| Auto-dismiss | Disabled by default (`duration={0}`) — errors require explicit dismissal |
| Progress bar | Hidden |

**Tailwind classes:**
```
flex gap-3 items-start
rounded-lg bg-white shadow-lg border-l-4 border-danger-500
p-4 min-w-[300px] max-w-[400px]
```

### `info`

| Property | Value |
|---|---|
| Left border | 4px solid `info.500` (`#2563EB`) |
| Background | `white` |
| Icon | `Info` (Lucide), `text-info-500` |
| Title color | `text-neutral-700` |
| Description color | `text-neutral-500` |
| Auto-dismiss | 4000ms (default) |
| Progress bar | Shown, `bg-info-500` |

**Tailwind classes:**
```
flex gap-3 items-start
rounded-lg bg-white shadow-lg border-l-4 border-info-500
p-4 min-w-[300px] max-w-[400px]
```

---

## Placement

- **Desktop:** Bottom-right corner, `fixed bottom-6 right-6 z-[100]`.
- **Mobile:** Bottom edge, full-width with `mx-4` margin, `fixed bottom-4 left-4 right-4 z-[100]`. Max width is `100%` minus margins.
- **Stacking:** Multiple toasts stack vertically. New toasts appear above previous ones (LIFO visual order, but FIFO dismiss order). Maximum 3 visible toasts at once; additional queue silently until space is available.

---

## States

- **Entering:** Slides in from the right (desktop) or slides up from the bottom (mobile). Duration: `250ms ease-out`. Respects `motion-reduce` — instant appear with no slide animation.
- **Default (visible):** Static display. Progress bar depletes if enabled.
- **Hover:** Progress bar pauses (auto-dismiss timer pauses on hover). This is a UX courtesy for users who need more time to read.
- **Dismiss (manual):** The `×` button is clicked. Toast slides out immediately (`150ms ease-in`). `onDismiss` fires.
- **Dismiss (auto):** After `duration` ms. Toast slides out. `onDismiss` fires.
- **Dismiss button focus-visible:** `ring-2 ring-offset-2 ring-brand-500` (same as all interactive elements).

---

## Progress Bar

When shown (`success` and `info`):
- Height: 3px
- Position: bottom of the toast card, `rounded-b-lg overflow-hidden`
- Animation: `scaleX` from 1 to 0 over `duration` ms, `linear` easing, `transform-origin: left`.
- CSP note: This animation is a CSS class animation (`@keyframes`), not an inline style — CSP-safe.
- Reduced motion: progress bar is hidden when `prefers-reduced-motion: reduce` is active.

---

## Dismiss Button

```
<button
  aria-label={t('toast.dismiss')}
  className="ml-auto -mt-1 -mr-1 h-8 w-8 flex items-center justify-center
             rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500
             motion-safe:transition-colors motion-safe:duration-150"
>
  <X size={16} aria-hidden="true" />
</button>
```

---

## Accessibility

- **ARIA role:** The toast container has `role="region"` with `aria-label` for the notification region. Individual toasts have `role="status"` (for `success`/`info`) or `role="alert"` (for `error`). `alert` announces immediately; `status` announces politely.
- **Live region:** The toast container uses `aria-live="polite"` for success/info and `aria-live="assertive"` for error. This is automatically covered by the `role` semantics above.
- **Keyboard:** The dismiss button is focusable. Pressing `Escape` when focus is anywhere in the toast should dismiss it (handled by the toast manager).
- **Focus management:** Focus does NOT move to the toast automatically — toasts are non-blocking. Focus remains where it was. The dismiss button is reachable via `Tab`.
- **Color alone:** Each variant uses both a distinctive border color AND a Lucide icon with distinct shape. Color is not the only differentiator.
- **Screen reader:** The title is the primary announcement. Description is supplementary.

---

## Responsive Behavior

- **Desktop (≥768px):** Positioned bottom-right. Width 300–400px.
- **Mobile (<768px):** Full-width, pinned to bottom. Height adapts to content. If the mobile keyboard is open (input focused), the toast should not obscure the keyboard — `bottom: env(keyboard-inset-height, 1rem)` or equivalent; developer-fe to verify in mobile browsers.

---

## Tokens Used

- **Colors:** `success.500`, `danger.500`, `info.500`, `white`, `neutral.400`, `neutral.500`, `neutral.600`, `neutral.700`, `neutral.100`
- **Spacing:** `p-4`, `gap-3`, `bottom-6 right-6` (desktop), `bottom-4 left-4 right-4` (mobile)
- **Typography:** `text-base font-medium` (title), `text-sm` (description)
- **Border radius:** `rounded-lg` (8px, `radius.md`)
- **Shadow:** `shadow-lg`
- **Motion:** `250ms ease-out` (enter), `150ms ease-in` (exit)
- **Z-index:** `z-[100]` — above all content including modals if possible

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `toast.dismiss` | Cerrar notificación | Dismiss notification |
| `toast.region.label` | Notificaciones | Notifications |
| `toast.success.loginLink.title` | Enlace enviado | Link sent |
| `toast.success.loginLink.description` | Revisa tu correo para iniciar sesión. | Check your email to sign in. |
| `toast.success.saved.title` | Cambios guardados | Changes saved |
| `toast.success.saved.description` | Tus cambios se guardaron correctamente. | Your changes have been saved. |
| `toast.error.generic.title` | Ocurrió un error | Something went wrong |
| `toast.error.generic.description` | Por favor intenta de nuevo. Si el problema persiste, recarga la página. | Please try again. If the problem persists, reload the page. |
| `toast.error.network.title` | Sin conexión | No connection |
| `toast.error.network.description` | Verifica tu conexión a internet e intenta de nuevo. | Check your internet connection and try again. |
| `toast.info.generic.title` | Información | Information |

---

## Examples

### Example 1: Magic link sent (success)
```
variant="success"
title={t('toast.success.loginLink.title')}
description={t('toast.success.loginLink.description')}
duration={5000}
```

### Example 2: Save failed (error, no auto-dismiss)
```
variant="error"
title={t('toast.error.generic.title')}
description={t('toast.error.generic.description')}
duration={0}
```

### Example 3: Info notification
```
variant="info"
title={t('toast.info.generic.title')}
duration={4000}
```

---

## Don'ts

- Don't use toasts for critical errors that block the user's workflow — use an inline error state or a blocking modal instead.
- Don't auto-dismiss error toasts — the user may not have read them.
- Don't stack more than 3 visible toasts — queue the rest.
- Don't use `aria-live="assertive"` for success/info — it interrupts screen reader users mid-task.
- Don't rely on toast color alone to indicate variant — always include the distinct icon.
- Don't put form validation errors in toasts — use inline field error states.
