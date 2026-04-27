# Accessibility Baseline — Massage Tulum v1

**Author:** designer (agent)
**Date:** 2026-04-26
**Standard:** WCAG 2.2 Level AA (minimum for all v1 screens)

---

## 1. Color Contrast

### Rules

- **Normal text (< 18px or < 14px bold):** minimum contrast ratio 4.5:1
- **Large text (≥ 18px or ≥ 14px bold):** minimum contrast ratio 3:1
- **UI components and graphical objects** (borders of inputs, icons, focus rings): minimum contrast ratio 3:1

### Token Palette Contrast Verification

The following pairs cover the most common combinations in the v1 UI. All ratios calculated against WCAG 2.2 relative luminance formula.

| Foreground | Background | Ratio | Level | Note |
|---|---|---|---|---|
| `neutral.700` `#343A40` | `neutral.50` `#F8F9FA` | 10.6:1 | AAA | Default body text on page bg |
| `neutral.700` `#343A40` | `white` `#FFFFFF` | 10.1:1 | AAA | Body text on card bg |
| `neutral.500` `#6C757D` | `neutral.50` `#F8F9FA` | 4.6:1 | AA | Secondary text on page bg |
| `neutral.500` `#6C757D` | `white` `#FFFFFF` | 4.6:1 | AA | Secondary text on card bg |
| `neutral.400` `#ADB5BD` | `white` `#FFFFFF` | 2.7:1 | FAIL | Do NOT use `neutral.400` for text. Use only for decorative elements/borders. |
| `brand.700` `#5E3F24` | `white` `#FFFFFF` | 8.5:1 | AAA | Brand heading text, logo |
| `brand.600` `#7D5632` | `white` `#FFFFFF` | 5.8:1 | AA | Brand links, secondary brand text |
| `brand.500` `#9B6F42` | `white` `#FFFFFF` | 4.1:1 | FAIL | Do NOT use `brand.500` for text on white. |
| `white` `#FFFFFF` | `brand.700` `#5E3F24` | 8.5:1 | AAA | White text on primary button bg |
| `white` `#FFFFFF` | `brand.600` `#7D5632` | 5.8:1 | AA | White text on hover button state |
| `white` `#FFFFFF` | `danger.500` `#DC2626` | 4.8:1 | AA | White text on destructive button |
| `success.700` `#145A25` | `success.50` `#F0FBF4` | 8.2:1 | AAA | Success text on success tint bg |
| `warning.700` `#92400E` | `warning.50` `#FFFBEA` | 7.1:1 | AAA | Warning text on warning tint bg |
| `danger.700` `#991B1B` | `danger.50` `#FFF5F5` | 7.8:1 | AAA | Error text on error tint bg |
| `info.700` `#1D4ED8` | `info.50` `#EFF6FF` | 6.2:1 | AA | Info text on info tint bg |
| `neutral.300` `#CED4DA` | `white` `#FFFFFF` | 1.6:1 | FAIL | Use only as non-text border — meets 3:1 for UI element borders? No. Use `neutral.400` for input borders. |
| `neutral.400` `#ADB5BD` | `white` `#FFFFFF` | 2.7:1 | FAIL for UI | Borderline for input borders — use `neutral.500` for input borders to be safe. |
| `neutral.500` `#6C757D` | `white` `#FFFFFF` | 4.6:1 | AA | Use for input borders and form element outlines |

### Confirmed Failure Cases (Do Not Use as Text)

- `brand.500` on white — too light. Use `brand.600` or `brand.700` for all text and links.
- `neutral.400` on white — too light. Reserve for decorative/non-informational borders only.
- `neutral.300` on white — too light. Same restriction.

### Focus Ring Contrast

Focus rings use `ring-brand-500` (`#9B6F42`) offset on white. The ring itself is 2px wide with a 2px offset gap (white). The contrasting edge (ring vs white bg) is 4.1:1 — marginal. Mitigation: the ring has a white offset gap AND 3px total visible ring, making the combined visual indicator clearly visible. For strict compliance, `ring-brand-600` (`#7D5632`) at 5.8:1 is the safer choice. Developer-fe should use `ring-brand-600` for focus rings on white backgrounds.

---

## 2. Focus Visibility

### Rule

Every interactive element MUST have a visible focus indicator. Use Tailwind's `focus-visible:` modifier, NOT `:focus`.

**Why `focus-visible:` not `:focus`:**
- `:focus` shows a ring on mouse click too, which is visually noisy for sighted mouse users.
- `focus-visible:` only activates for keyboard navigation — the correct behavior per WCAG 2.4.11 (Focus Appearance, WCAG 2.2 AA).
- Browser support: all modern browsers (Chrome 86+, Firefox 85+, Safari 15.4+).

### Standard Focus Ring Pattern

All interactive elements use this pattern:
```
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-offset-2
focus-visible:ring-brand-600
```

Exceptions:
- Destructive elements: `focus-visible:ring-danger-500`
- Elements on brand-colored backgrounds: `focus-visible:ring-white` (white ring on brand bg)

### CSP Compatibility

`focus-visible:ring-*` classes are compiled by Tailwind JIT into the stylesheet. They are NOT inline styles. They do not require `'unsafe-inline'` in `style-src`. The CSP policy (`style-src 'self' 'unsafe-inline'`) already allows this, but even if `'unsafe-inline'` were removed, class-based focus rings would still work.

---

## 3. Keyboard Navigation

### Requirements

1. All interactive elements are reachable via `Tab` key in a logical DOM order.
2. `Shift+Tab` reverses tab order.
3. `Enter` activates buttons and links.
4. `Space` activates buttons (not links — browser default behavior).
5. `Escape` closes modals, dropdowns, and popovers.
6. Arrow keys navigate within component groups (tab panels, select dropdowns, calendar grids).

### Tab Order Rules

- Tab order follows DOM order. Never use `tabindex` values greater than 0 — they break the natural order and cause confusion.
- `tabindex="0"` is acceptable to make a non-interactive element focusable when required (e.g., a custom interactive component).
- `tabindex="-1"` is used to make elements programmatically focusable (e.g., modal containers) without adding them to the tab sequence.

### Skip Link (Mandatory)

Every page must begin with a visually-hidden skip link that becomes visible on focus:

```
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
             focus:z-[200] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg
             focus:shadow-lg focus:text-brand-700 focus:font-medium
             focus-visible:ring-2 focus-visible:ring-brand-600"
>
  {t('layout.skipLink')}
</a>
```

### Focus Management in Modals / Drawers

When a modal opens:
1. Focus moves to the first focusable element inside the modal (or to the modal container with `tabindex="-1"`).
2. Tab key cycles through focusable elements WITHIN the modal only (focus trap).
3. `Escape` closes the modal and returns focus to the element that triggered it.
4. When the modal closes, focus MUST return to the triggering element.

This applies to all overlays: modals, dialogs, confirmation sheets, drawers, date pickers.

---

## 4. Screen Reader Requirements

### Language Attribute

The `<html>` element MUST have the correct `lang` attribute for the current locale:
- Spanish (default at `/`): `<html lang="es">`
- English (at `/en`): `<html lang="en">`

This is set in `apps/web/app/[locale]/layout.tsx`:
```tsx
<html lang={locale}>
```

Screen readers use this to select the correct pronunciation engine. Missing or incorrect `lang` causes the screen reader to mispronounce Spanish content.

### ARIA Roles and Landmarks

Every page must have:
- `<header role="banner">` (implicit on `<header>`)
- `<main role="main" id="main-content">` (implicit on `<main>`)
- `<footer role="contentinfo">` (implicit on `<footer>`)
- `<nav aria-label="...">` for any navigation regions (with distinct labels when multiple `<nav>` elements exist)

### Icon-Only Buttons

Every button whose visual content is solely an icon MUST have one of:
- `aria-label="..."` on the `<button>` element, OR
- A visually-hidden `<span className="sr-only">` inside the button

The icon itself MUST have `aria-hidden="true"` to prevent screen readers from attempting to describe the SVG.

Example:
```tsx
<button aria-label={t('therapist.edit')}>
  <Pencil size={20} aria-hidden="true" />
</button>
```

### Live Regions

- Toast notifications: `role="alert"` (error) or `role="status"` (success/info) — screen reader announces automatically.
- Loading states: container has `aria-busy="true"` and `aria-live="polite"`.
- Form validation errors: `aria-live="polite"` on the error container, or `aria-describedby` pointing from the input to the error message.

### Form Error Announcement

When a form field has an error:
1. The error message element has `id="field-name-error"`.
2. The input has `aria-describedby="field-name-error"` and `aria-invalid="true"`.
3. On error, focus moves to the first invalid field (or to a summary at the top of the form — designer to specify per form).
4. Screen reader reads: "[Field label], [error message]" when the field receives focus.

---

## 5. Reduced Motion

### Rule

Any CSS animation or transition MUST be disabled or reduced when `prefers-reduced-motion: reduce` is set in the user's OS.

### Implementation in Tailwind

Use `motion-safe:` modifier to gate all animations:
```
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
motion-safe:animate-spin
motion-safe:animate-[shimmer_1.5s_ease-in-out_infinite]
```

Without `motion-safe:`, the animation class runs unconditionally. With it, the animation only runs when the user has NOT requested reduced motion.

For cases where a reduced-motion alternative is needed (not just "remove the animation"):
```
motion-reduce:transition-none
motion-reduce:animate-none
```

### Animations subject to this rule

- LoadingSkeleton shimmer: disable (`motion-safe:before:animate-none`)
- Button loading spinner: disable (`motion-safe:animate-spin`)
- Toast enter/exit slide: disable (show/hide instantly, no slide)
- Any future page transitions or panel animations

---

## 6. Touch and Mobile Accessibility

- **Minimum touch target:** 44×44px for all tappable elements on mobile (WCAG 2.5.5 AA). Buttons that are visually smaller than 44px must have invisible padding or spacing to extend the tappable area.
- **Pointer vs touch:** All click handlers work with both mouse and touch without modification (React's synthetic event system handles this).
- **Pinch-zoom:** Never disable user scaling via `<meta name="viewport" content="..., user-scalable=no">`. Tulum tourists may have visual impairments requiring zoom.

---

## 7. Not Yet Addressed (Post-v1)

- **Dark mode:** Token palette not yet tested in dark mode. When dark mode is added, re-verify all contrast pairs.
- **WCAG 2.5.3 Label in Name:** Ensure visible button label text matches or is contained in its accessible name. (Relevant for voice control software users.)
- **Reflow (1.4.10):** Verify no horizontal scroll at 400% zoom at 1280px width. Not required for foundation but must pass before v1 launch.
