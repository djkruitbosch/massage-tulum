# Responsive Design Baseline — Massage Tulum v1

**Author:** designer (agent)
**Date:** 2026-04-26

---

## 1. Breakpoints

Tailwind CSS default breakpoints are used as-is. No custom breakpoints at foundation.

| Name | Min width | Tailwind prefix | Primary target devices |
|---|---|---|---|
| (default/mobile) | 0px | (no prefix) | Small phones, 375px minimum |
| `sm` | 640px | `sm:` | Large phones, small tablets |
| `md` | 768px | `md:` | Tablets, phablets |
| `lg` | 1024px | `lg:` | Laptops, desktop primary |
| `xl` | 1280px | `xl:` | Wide desktops |
| `2xl` | 1536px | `2xl:` | Large monitors |

**Supported minimum width: 375px.** This is the iPhone SE viewport width and represents the smallest device the studio owner is realistically using. Anything narrower is out of scope for v1.

---

## 2. Authoring Strategy: Desktop-First

### Decision

**Desktop-first** authoring. Write default (no-prefix) Tailwind classes for the desktop target (≥1024px), then use responsive prefixes to progressively adjust for narrower viewports.

Example:
```html
<!-- Desktop-first: full layout at lg+, stacked at mobile -->
<div class="flex gap-8 md:flex-col sm:gap-4">
```

### Rationale

The primary user — the studio owner — uses this tool on a desktop or laptop at their studio. The schedule view, booking tables, and multi-column layouts are designed for wide viewports. Forcing a mobile-first approach would make the desktop styles cluttered with override utilities.

### Constraint: No Horizontal Scroll at 375px

Despite desktop-first authoring, **every page must render without horizontal scroll at 375px viewport width.** This is a non-negotiable quality bar, not a "nice to have."

Verification: after each new page is implemented, developer-fe runs Chrome DevTools responsive mode at 375px and confirms `document.documentElement.scrollWidth === 375`. Any page that causes horizontal scroll is a blocker — it fails QA.

Common causes to avoid:
- Fixed-width elements wider than the viewport (`width: 400px` on a card with no `max-w-full`)
- `whitespace-nowrap` on long text strings without overflow handling
- Nested flex containers that don't wrap at small viewports

---

## 3. Container Behavior

### Container Max-Widths

Defined in `tokens.md` and `tailwind.config.ts`:

| Name | Max width | Tailwind class | Usage |
|---|---|---|---|
| `narrow` | 640px | `max-w-[640px]` | Login/auth forms, single-field screens |
| `content` | 960px | `max-w-[960px]` | Standard content pages, dashboards with sidebar |
| `wide` | 1280px | `max-w-[1280px]` | Schedule view, booking tables |
| `full` | 100% | `max-w-full` | Edge-to-edge panels, full-bleed headers/footers |

All containers are centered with `mx-auto`.

### Horizontal Padding Per Breakpoint

Applied to the inner container at each breakpoint:

| Breakpoint | Class | px value | Notes |
|---|---|---|---|
| Mobile default | `px-4` | 16px | Both sides |
| `sm` (640px+) | `sm:px-6` | 24px | Slightly more breathing room |
| `lg` (1024px+) | `lg:px-8` | 32px | Desktop standard |
| `xl` (1280px+) | `xl:px-10` | 40px | Wide desktop |

Combined class string on a typical content container:
```
mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 xl:px-10
```

The header and footer use the same horizontal padding pattern, ensuring visual alignment between the chrome and content.

---

## 4. Touch Target Rule

**Minimum tappable area: 44×44px for any interactive element on mobile.**

This is WCAG 2.5.5 (Level AA in WCAG 2.2) and also matches Apple HIG and Material Design guidelines.

Implementation approaches:
1. **Size the element directly:** `h-11 w-11` (44px) or larger. Preferred when the element is large enough to show naturally.
2. **Extend via padding:** add invisible padding to increase the tappable area without affecting the visual size. Use `p-2` to add 8px on each side to a 28px element → net 44px.
3. **Use `min-h-[44px]` and `min-w-[44px]`** as a safety net on touch-critical elements.

### Applies To

- All `<button>` elements
- All `<a>` elements (links)
- All form controls (checkboxes, radios, toggles)
- The LanguageSwitcher buttons (the `h-8` height means these are 32px tall — border padding from the surrounding header provides additional tap area; verify at 375px)
- Icon-only toolbar buttons

### Does Not Apply To

- Non-interactive text
- Decorative elements
- Disabled elements (though a reasonable visual size is still good practice)

---

## 5. Typography Responsive Scaling

The type scale in `tokens.md` is defined for desktop. On mobile, the following adjustments apply:

| Desktop class | Mobile override | When to apply |
|---|---|---|
| `text-4xl` (h1, 36px) | `text-2xl sm:text-4xl` | Full-page hero titles |
| `text-3xl` (h2, 30px) | `text-xl sm:text-3xl` | Section headings |
| `text-2xl` (h3, 24px) | `text-lg sm:text-2xl` | Card titles |
| `text-xl` (h4, 20px) | `text-base sm:text-xl` | Sub-section labels |
| `text-base` (body) | `text-base` (no change) | Body copy scales fine |
| `text-sm` (small) | `text-sm` (no change) | Small text scales fine |

These are recommendations, not mandates. Feature designers specify typography at their level.

---

## 6. Layout Patterns — Mobile Adaptations

### Horizontal → Vertical Stacking

Multi-column layouts on desktop must stack vertically on mobile. Use Tailwind flex with wrapping:

```html
<!-- Desktop: side-by-side; Mobile: stacked -->
<div class="flex gap-4 md:flex-col md:gap-2">
```

Or CSS Grid:
```html
<!-- Desktop: 3 columns; Tablet: 2 columns; Mobile: 1 column -->
<div class="grid grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4">
```

### Sidebar → Hidden / Drawer

Pages with a sidebar (e.g., the schedule view or a navigation sidebar in future features) should:
- On mobile: hide the sidebar by default; show it in a drawer triggered by a hamburger/menu button.
- The drawer overlays the main content (not push-layout) to preserve reading position.
- Drawer spec is defined per feature when sidebars are introduced.

### Tables → Horizontal Scroll or Card Conversion

Data tables on desktop:
- On tablet/mobile: wrap in `overflow-x-auto` container to allow horizontal scrolling.
- For simple tables (< 5 columns), consider converting to a stacked card list on mobile.
- The schedule view (column-per-therapist) will require specific mobile treatment — defined in the schedule feature design.

### Form Layouts

- Multi-column forms (e.g., first name | last name on one row) stack to single column on mobile.
- Submit buttons become `fullWidth` on mobile.
- Label placement: above the field on all breakpoints (not inline/side) for v1.

---

## 7. Images and Media

No images in v1 foundation. When added:
- Use `next/image` with `sizes` attribute to serve appropriately sized images per viewport.
- Always provide `alt` text.
- Logos: provide SVG (resolution-independent).

---

## 8. Schedule View — Mobile Priority Note

The daily column-per-therapist schedule view is the core of the studio owner's workflow. It is inherently a wide, multi-column layout. On mobile:
- Minimum viable: horizontal scroll within the schedule grid (the container scrolls, not the whole page).
- Preferred: a condensed single-therapist view with a therapist selector (swipe or dropdown).
- This will be specified in detail in the Schedule feature design doc.
- For now, note that 375px is non-negotiable for horizontal-scroll-free page chrome, but the schedule grid itself may scroll horizontally within its container.

---

## 9. Testing Checklist (Per Page, Before QA)

- [ ] Rendered at 375px width: no horizontal scroll on the page body
- [ ] Rendered at 768px: layout reflows appropriately
- [ ] Rendered at 1024px: primary desktop layout is correct
- [ ] All touch targets are ≥ 44px on mobile
- [ ] Text does not overflow containers at 375px
- [ ] Images (when added) are not overflowing containers
- [ ] No fixed-width elements causing layout breakage
