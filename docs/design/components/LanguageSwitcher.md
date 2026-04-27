# Component: LanguageSwitcher

**Used in:** Foundation, all pages (via LayoutShell)
**Designer doc:** `docs/design/foundation-home.md`
**Status:** Spec
**Date:** 2026-04-26

---

## Purpose

A small, always-visible control that lets the user switch between Spanish (`es`) and English (`en`). Triggers a Next.js navigation to the locale-prefixed path while preserving the current route. Lives in the top-right of the header on desktop; moves into a mobile navigation drawer on screens <768px (once the nav drawer exists; at foundation stage it remains visible in the header at all sizes).

---

## Design Decision: Button Pair, Not Dropdown

At v1, with only two locales, a segmented button pair is clearer than a dropdown. It shows both options at once and requires one tap. A dropdown costs an extra tap and hides context.

**Appearance:**
```
[ ES | EN ]
```
Two adjacent buttons forming a group. The active locale is visually filled; the inactive is outlined/ghost. This functions like a segmented control.

---

## Anatomy

```
<div role="group" aria-label="Seleccionar idioma / Select language">
  <button  [ES]  active/inactive >
  <button  [EN]  active/inactive >
</div>
```

No dropdown, no chevron, no popover at v1.

---

## Props

```typescript
interface LanguageSwitcherProps {
  locale: string;          // Current active locale: 'es' | 'en'
  // The component reads the current pathname internally via usePathname()
  // and builds the alternate locale URL itself
}
```

---

## States per Button

Each locale button has the following states:

| State | Active locale button | Inactive locale button |
|---|---|---|
| Default | `bg-brand-700 text-white` (filled) | `bg-white text-neutral-600 border-neutral-200` (outlined) |
| Hover | n/a (already selected — no hover effect change) | `bg-neutral-100 text-neutral-700` |
| Focus-visible | `ring-2 ring-offset-2 ring-brand-500` | `ring-2 ring-offset-2 ring-brand-500` |
| Active (press) | n/a | `bg-neutral-200` |
| Disabled | Not applicable — both buttons are always interactive |

---

## Tailwind Classes

**Wrapper:**
```
flex rounded-lg overflow-hidden border border-neutral-200 shadow-sm
```

**Active button (selected locale):**
```
h-8 px-3 text-sm font-medium bg-brand-700 text-white
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-500
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

**Inactive button (alternate locale link):**
```
h-8 px-3 text-sm font-medium bg-white text-neutral-600
hover:bg-neutral-100 hover:text-neutral-700
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-500
active:bg-neutral-200
motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out
```

**Separator between buttons:** The `border-r border-neutral-200` class on the first button creates a visual divider.

---

## Navigation Behavior

The inactive button navigates to the alternate locale path using next-intl's `<Link>` component (or `useRouter` + `usePathname` on the client side).

**Routing logic (for developer-fe reference):**
- The component is a Client Component (`"use client"`) because it uses `usePathname` and `useRouter` from `next-intl/navigation`.
- Clicking the inactive locale button calls `router.replace(pathname, { locale: targetLocale })`.
- With `localePrefix: 'as-needed'`, switching from `es` → `en` navigates `/dashboard` → `/en/dashboard`. Switching back strips the prefix: `/en/dashboard` → `/dashboard`.
- The active locale button is rendered as a `<button>` with `aria-current="true"` and `aria-disabled="true"` (it is a button, not a link, because clicking it does nothing — the user is already on this locale).

**CSP note:** This uses React event handlers (`onClick`) not inline HTML event attributes — fully CSP-compliant. No `<script>` tags involved.

---

## Accessibility

- **ARIA role:** `role="group"` on the wrapper with `aria-label` in the current locale language (see Copy section).
- **Keyboard:** `Tab` focuses the group; both buttons are tab-reachable. `Enter` / `Space` activate the focused button.
- **Active button:** `aria-current="true"` indicates the currently selected locale to screen readers. Do not add `aria-pressed` — this is not a toggle button pattern; it is a selection pattern.
- **Inactive button:** No `aria-current`. Screen readers read the button label as a link/action.
- **Screen reader announcement:** When navigating, next-intl reloads the page with the new locale. The `<html lang>` attribute changes. Screen readers announce the new language context automatically.
- **Icon-only risk:** The buttons show only "ES" and "EN" text abbreviations. These are internationally understood abbreviations for the language names. However, add `title` attributes for extra clarity: `title="Español"` / `title="English"`.

---

## Placement

| Breakpoint | Placement |
|---|---|
| Desktop (≥768px) | Top-right of header, inside the `<header>` element |
| Mobile (<768px) | At foundation stage: same header position (no hamburger menu yet). When mobile nav drawer is added in a future feature, the LanguageSwitcher moves to the bottom of the drawer. |

**Header positioning classes:** `flex items-center gap-4` in the header right slot places the LanguageSwitcher with appropriate spacing from any other header items.

---

## Responsive Behavior

- **Desktop (≥1024px):** Full `[ ES | EN ]` button pair visible in header.
- **Tablet (768–1023px):** Same as desktop.
- **Mobile (375–767px):** Same button pair visible. At 375px, "ES" and "EN" each fit comfortably in `px-3 h-8` (approximately 40×32px each). Acceptable at foundation stage; touch target is slightly under 44px height — the parent header provides sufficient surrounding tap area.

---

## Tokens Used

- **Colors:** `brand.700`, `white`, `neutral.200`, `neutral.100`, `neutral.600`, `neutral.700`
- **Spacing:** `h-8`, `px-3`
- **Typography:** `text-sm font-medium`
- **Border radius:** `rounded-lg` on wrapper, `overflow-hidden` to clip children
- **Shadow:** `shadow-sm`
- **Motion:** `duration-150 ease-out`

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `languageSwitcher.label` | Seleccionar idioma | Select language |
| `languageSwitcher.es` | ES | ES |
| `languageSwitcher.en` | EN | EN |
| `languageSwitcher.es.title` | Español | Spanish |
| `languageSwitcher.en.title` | Inglés | English |
| `languageSwitcher.current` | Idioma actual: {locale} | Current language: {locale} |

---

## Examples

### Example 1: Spanish active (default)
```
[ ES (filled/brand) | EN (outlined) ]
Renders at / (no locale prefix)
```

### Example 2: English active
```
[ ES (outlined) | EN (filled/brand) ]
Renders at /en/...
```

---

## Don'ts

- Don't use a dropdown select element — it adds interaction cost and looks out of place for two options.
- Don't add a globe icon unless the design becomes too text-heavy. The "ES / EN" labels are self-describing.
- Don't hardcode the locale paths manually — always derive them from `usePathname` + next-intl routing to avoid broken paths when routes change.
- Don't mark the active button as `disabled` via the `disabled` HTML attribute — it removes it from tab order. Use `aria-current="true"` and `aria-disabled="true"` instead, and prevent the click handler from firing.
