# Design Tokens — Massage Tulum v1

**Author:** designer (agent)
**Date:** 2026-04-26
**Status:** Draft — pending human brand review at GATE 2

> GATE 2 note: The palette below is a designer-authored starting point. If the studio owner has an existing logo, brand color, or color preference, those inputs should override §1.1 before the developer-fe implements the Tailwind config.

---

## 1. Color Palette

### 1.1 Brand Primary

Warm sand / aged terracotta. Not a Tulum beach cliché — the tone reads as a professional warm neutral, like quality linen or natural stone. Avoids both the tourist-beach turquoise cliché and the clinical coldness of pure gray.

| Token name | Hex | Tailwind key | Usage |
|---|---|---|---|
| `brand.50` | `#FAF6F1` | `brand-50` | Page backgrounds, subtle tints |
| `brand.100` | `#F2E9DC` | `brand-100` | Card backgrounds, hover tints |
| `brand.200` | `#E3CEB4` | `brand-200` | Borders, dividers |
| `brand.300` | `#CEAE87` | `brand-300` | Disabled text, placeholder text |
| `brand.400` | `#B88E60` | `brand-400` | Secondary icons |
| `brand.500` | `#9B6F42` | `brand-500` | Primary brand accent (links, active states) |
| `brand.600` | `#7D5632` | `brand-600` | Button hover, focus ring |
| `brand.700` | `#5E3F24` | `brand-700` | Dark accent, headings on light bg |
| `brand.800` | `#3E2917` | `brand-800` | Deep emphasis |
| `brand.900` | `#1F140B` | `brand-900` | Near-black for text (rare) |

### 1.2 Neutral Grays (cool-toned to avoid clash with warm brand)

| Token name | Hex | Tailwind key | Usage |
|---|---|---|---|
| `neutral.50` | `#F8F9FA` | `neutral-50` | App background (default page bg) |
| `neutral.100` | `#F1F3F5` | `neutral-100` | Sidebar background, table stripes |
| `neutral.200` | `#E9ECEF` | `neutral-200` | Borders, input backgrounds |
| `neutral.300` | `#CED4DA` | `neutral-300` | Disabled borders |
| `neutral.400` | `#ADB5BD` | `neutral-400` | Placeholder text |
| `neutral.500` | `#6C757D` | `neutral-500` | Secondary text, icons |
| `neutral.600` | `#495057` | `neutral-600` | Body text (secondary) |
| `neutral.700` | `#343A40` | `neutral-700` | Body text (primary) |
| `neutral.800` | `#212529` | `neutral-800` | Headings, high-emphasis text |
| `neutral.900` | `#0D0F12` | `neutral-900` | Maximum contrast (use sparingly) |

### 1.3 Semantic Colors

| Token name | Hex | Tailwind key | Usage |
|---|---|---|---|
| `success.50` | `#F0FBF4` | `success-50` | Success background tint |
| `success.500` | `#22863A` | `success-500` | Success icon, border |
| `success.700` | `#145A25` | `success-700` | Success text (on white) |
| `warning.50` | `#FFFBEA` | `warning-50` | Warning background tint |
| `warning.500` | `#D97706` | `warning-500` | Warning icon, border |
| `warning.700` | `#92400E` | `warning-700` | Warning text (on white) |
| `danger.50` | `#FFF5F5` | `danger-50` | Error background tint |
| `danger.500` | `#DC2626` | `danger-500` | Error icon, border, destructive button |
| `danger.700` | `#991B1B` | `danger-700` | Error text (on white) |
| `info.50` | `#EFF6FF` | `info-50` | Info background tint |
| `info.500` | `#2563EB` | `info-500` | Info icon, border |
| `info.700` | `#1D4ED8` | `info-700` | Info text (on white) |

### 1.4 Background / Foreground

| Token | Value | Notes |
|---|---|---|
| `bg.page` | `neutral.50` (`#F8F9FA`) | Default page background |
| `bg.surface` | `#FFFFFF` | Cards, panels, modals |
| `bg.subtle` | `neutral.100` (`#F1F3F5`) | Sidebar, table row alternate |
| `fg.default` | `neutral.700` (`#343A40`) | Default body text |
| `fg.muted` | `neutral.500` (`#6C757D`) | Secondary text, captions |
| `fg.onBrand` | `#FFFFFF` | Text on brand-colored backgrounds |
| `fg.onDanger` | `#FFFFFF` | Text on danger-colored backgrounds |

### 1.5 Contrast Verification (WCAG 2.2 AA)

| Foreground | Background | Ratio | Pass? |
|---|---|---|---|
| `fg.default` `#343A40` | `bg.page` `#F8F9FA` | ~10.6:1 | Pass (AAA) |
| `fg.muted` `#6C757D` | `bg.page` `#F8F9FA` | ~4.6:1 | Pass (AA) |
| `fg.muted` `#6C757D` | `bg.surface` `#FFFFFF` | ~4.6:1 | Pass (AA) |
| `brand.500` `#9B6F42` on white | `#FFFFFF` | ~4.1:1 | MARGINAL — use `brand.600` for text links |
| `brand.600` `#7D5632` on white | `#FFFFFF` | ~5.8:1 | Pass (AA) |
| `fg.onBrand` `#FFFFFF` | `brand.500` `#9B6F42` | ~4.1:1 | MARGINAL — prefer brand.600 or brand.700 as button bg |
| `fg.onBrand` `#FFFFFF` | `brand.600` `#7D5632` | ~5.8:1 | Pass (AA) |
| `fg.onBrand` `#FFFFFF` | `brand.700` `#5E3F24` | ~8.5:1 | Pass (AAA) |
| `success.700` `#145A25` | `success.50` `#F0FBF4` | ~8.2:1 | Pass (AAA) |
| `warning.700` `#92400E` | `warning.50` `#FFFBEA` | ~7.1:1 | Pass (AAA) |
| `danger.700` `#991B1B` | `danger.50` `#FFF5F5` | ~7.8:1 | Pass (AAA) |
| `info.700` `#1D4ED8` | `info.50` `#EFF6FF` | ~6.2:1 | Pass (AA) |

**Rule:** Primary Button uses `brand.700` background with white text. Text links use `brand.600`. Never use `brand.500` as background for white text.

---

## 2. Typography

### 2.1 Font Families

**Heading font:** `Plus Jakarta Sans`
- Google Fonts URL: https://fonts.google.com/specimen/Plus+Jakarta+Sans
- Free, open license (SIL Open Font License)
- Full Latin Extended character set — covers all Spanish accented characters (á, é, í, ó, ú, ñ, ü, ¡, ¿)
- Weights available: 300, 400, 500, 600, 700, 800
- Rationale: Geometric, professional, slightly warm — avoids both "tech startup" coldness and decorative excess. Pairs well with a serif or neutral body font.

**Body font:** `Inter`
- Google Fonts URL: https://fonts.google.com/specimen/Inter
- Free, open license (SIL Open Font License)
- Full Latin Extended character set — Spanish accented characters fully supported
- Weights available: 100–900
- Rationale: Workhorse UI font. Maximum legibility at small sizes. Excellent for data-dense screens like the schedule view. The tool-not-marketing-site tone benefits from Inter's directness.

**Fallback stack (both):**
```
'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

### 2.2 Type Scale

All sizes in `rem` (base = 16px). Tailwind size reference listed alongside.

| Token | rem | px equiv | Line height | Weight | Tailwind approx | Usage |
|---|---|---|---|---|---|---|
| `text.h1` | 2.25rem | 36px | 1.2 | 700 | `text-4xl font-bold` | Page titles (rare, large screens) |
| `text.h2` | 1.875rem | 30px | 1.25 | 700 | `text-3xl font-bold` | Section headings |
| `text.h3` | 1.5rem | 24px | 1.3 | 600 | `text-2xl font-semibold` | Card titles, modal headings |
| `text.h4` | 1.25rem | 20px | 1.35 | 600 | `text-xl font-semibold` | Sub-section labels |
| `text.body` | 1rem | 16px | 1.5 | 400 | `text-base` | Default body copy |
| `text.bodyMedium` | 1rem | 16px | 1.5 | 500 | `text-base font-medium` | Emphasized body, button labels |
| `text.small` | 0.875rem | 14px | 1.5 | 400 | `text-sm` | Secondary info, table cells |
| `text.smallMedium` | 0.875rem | 14px | 1.5 | 500 | `text-sm font-medium` | Labels, badges |
| `text.caption` | 0.75rem | 12px | 1.4 | 400 | `text-xs` | Timestamps, footnotes |
| `text.captionMedium` | 0.75rem | 12px | 1.4 | 500 | `text-xs font-medium` | Status pills, small labels |

**Note:** `h1` through `h3` use `Plus Jakarta Sans`. `body` through `caption` use `Inter`. In practice, Tailwind's `fontFamily` config sets this via CSS variables.

---

## 3. Spacing Scale

Tailwind's default spacing scale (0.25rem per unit) is used as-is. No custom additions at foundation.

**Container max-widths (non-Tailwind defaults — must add to config):**

| Container name | Max width | Tailwind key | Usage |
|---|---|---|---|
| `container.narrow` | 640px | `max-w-[640px]` or `max-w-prose` | Login forms, single-column forms |
| `container.content` | 960px | `max-w-[960px]` | Standard content pages |
| `container.wide` | 1280px | `max-w-[1280px]` | Dashboard, schedule view |
| `container.full` | 100% | `max-w-full` | No restriction (edge-to-edge panels) |

**Container horizontal padding per breakpoint:**

| Breakpoint | Padding |
|---|---|
| Mobile (default, <640px) | `px-4` (16px) |
| sm (640px+) | `px-6` (24px) |
| lg (1024px+) | `px-8` (32px) |
| xl (1280px+) | `px-10` (40px) |

---

## 4. Border Radius

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `radius.sm` | 4px | `rounded` | Badges, pills, small chips |
| `radius.md` | 8px | `rounded-lg` | Buttons, inputs, cards (default) |
| `radius.lg` | 16px | `rounded-2xl` | Modals, panels, large cards |
| `radius.full` | 9999px | `rounded-full` | Avatars, loading spinners, toggle switches |

**Default radius for interactive elements:** `radius.md` (8px / `rounded-lg`).

---

## 5. Shadows

Calm, minimal. No harsh drop shadows. Uses warm-tinted shadow color to feel integrated with the palette.

| Token | Value | Tailwind key | Usage |
|---|---|---|---|
| `shadow.sm` | `0 1px 2px rgba(20, 14, 8, 0.06)` | `shadow-sm` | Subtle card lift |
| `shadow.md` | `0 4px 8px rgba(20, 14, 8, 0.08), 0 1px 3px rgba(20, 14, 8, 0.05)` | `shadow-md` | Cards, dropdowns |
| `shadow.lg` | `0 12px 24px rgba(20, 14, 8, 0.10), 0 4px 8px rgba(20, 14, 8, 0.06)` | `shadow-lg` | Modals, popovers |
| `shadow.focus` | `0 0 0 3px rgba(125, 86, 50, 0.35)` | custom (see focus ring) | Focus ring for brand elements |
| `shadow.focusDanger` | `0 0 0 3px rgba(220, 38, 38, 0.30)` | custom | Focus ring for destructive elements |

**Note:** Focus ring shadow is not an inline style — it is implemented via Tailwind `focus-visible:ring-*` utilities, which compile to CSS class rules. This is CSP-safe because Tailwind JIT emits these as stylesheet rules, not inline style attributes.

---

## 6. Motion and Transitions

**Design principle:** Motion should confirm an action, not entertain. Nothing animates unless it serves clarity.

| Token | Value | Usage |
|---|---|---|
| `duration.fast` | 100ms | Micro-interactions (button active state) |
| `duration.base` | 150ms | Default transitions (hover, focus) |
| `duration.slow` | 250ms | Panel slide-ins, dropdown open |
| `easing.enter` | `cubic-bezier(0, 0, 0.2, 1)` (`ease-out`) | Elements entering the screen |
| `easing.exit` | `cubic-bezier(0.4, 0, 1, 1)` (`ease-in`) | Elements leaving the screen |
| `easing.standard` | `cubic-bezier(0.4, 0, 0.2, 1)` (`ease-in-out`) | Position changes, reflows |

Tailwind transitions to use: `transition-colors duration-150 ease-out` for color changes. `transition-all duration-[250ms] ease-out` for panel animations.

**Reduced motion:** All motion specs include a `prefers-reduced-motion: reduce` override that removes transitions. In Tailwind: wrap motion classes in `motion-safe:` modifier. Example: `motion-safe:transition-colors motion-safe:duration-150`. See `docs/design/accessibility.md`.

---

## 7. Iconography

**Chosen icon set: Lucide Icons**

- License: ISC (free, open, commercial-use allowed)
- Package: `lucide-react` (React-specific, tree-shakeable)
- npm: https://www.npmjs.com/package/lucide-react
- Icon count: ~1,400 icons (2026)
- Style: Outline, 24×24 grid, 2px stroke width (adjustable via `strokeWidth` prop)
- Rationale: Outline style matches the calm, professional aesthetic better than filled icon sets. Lucide's consistent geometric style avoids the "mixed icon library" visual noise. The React package is tree-shakeable — unused icons add zero bytes to the bundle. Superior coverage for business-UI concepts (calendar, users, clipboard, etc.) compared to Heroicons at equivalent count. Maintained and actively developed.

**Usage rules:**
- Default size: 20px (`size={20}`) for inline use, 16px (`size={16}`) for small/dense contexts
- Stroke width: `strokeWidth={1.5}` for heading-level, `strokeWidth={2}` for body-level (Lucide default)
- Color: inherit from text color (`currentColor`) — never hardcode icon color
- Icon-only buttons MUST have an `aria-label` attribute

---

## 8. Tailwind `theme.extend` Object

Paste this into `tailwind.config.ts` under `theme.extend`. The developer-fe should also configure `fontFamily` and Google Fonts loading.

```typescript
// tailwind.config.ts — theme.extend section
// NOTE: this is configuration, not production component code.
// Developer-fe implements this; designer specifies it.

const themeExtend = {
  colors: {
    brand: {
      50:  '#FAF6F1',
      100: '#F2E9DC',
      200: '#E3CEB4',
      300: '#CEAE87',
      400: '#B88E60',
      500: '#9B6F42',
      600: '#7D5632',
      700: '#5E3F24',
      800: '#3E2917',
      900: '#1F140B',
    },
    neutral: {
      50:  '#F8F9FA',
      100: '#F1F3F5',
      200: '#E9ECEF',
      300: '#CED4DA',
      400: '#ADB5BD',
      500: '#6C757D',
      600: '#495057',
      700: '#343A40',
      800: '#212529',
      900: '#0D0F12',
    },
    success: {
      50:  '#F0FBF4',
      500: '#22863A',
      700: '#145A25',
    },
    warning: {
      50:  '#FFFBEA',
      500: '#D97706',
      700: '#92400E',
    },
    danger: {
      50:  '#FFF5F5',
      500: '#DC2626',
      700: '#991B1B',
    },
    info: {
      50:  '#EFF6FF',
      500: '#2563EB',
      700: '#1D4ED8',
    },
  },
  fontFamily: {
    heading: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
    body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
    sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'], // override Tailwind default
  },
  fontSize: {
    // Tailwind defaults are preserved; these add semantic aliases
    // Use standard Tailwind size utilities (text-base, text-sm, etc.) directly
    // These are for documentation reference only — no custom fontSize needed
  },
  borderRadius: {
    // Extend Tailwind defaults
    // 'rounded' = 4px (kept as Tailwind default)
    // 'rounded-lg' = 8px (kept as Tailwind default)
    // 'rounded-2xl' = 16px (kept as Tailwind default)
    // 'rounded-full' = 9999px (kept as Tailwind default)
    // No custom additions needed — Tailwind defaults match token spec exactly
  },
  boxShadow: {
    sm:  '0 1px 2px rgba(20, 14, 8, 0.06)',
    md:  '0 4px 8px rgba(20, 14, 8, 0.08), 0 1px 3px rgba(20, 14, 8, 0.05)',
    lg:  '0 12px 24px rgba(20, 14, 8, 0.10), 0 4px 8px rgba(20, 14, 8, 0.06)',
    'focus-brand':  '0 0 0 3px rgba(125, 86, 50, 0.35)',
    'focus-danger': '0 0 0 3px rgba(220, 38, 38, 0.30)',
  },
  transitionDuration: {
    fast: '100ms',
    base: '150ms',  // maps to duration-[150ms] — 150 is not a Tailwind default step
    slow: '250ms',
  },
  maxWidth: {
    narrow:  '640px',
    content: '960px',
    wide:    '1280px',
  },
};
```

**Google Fonts loading:** In `apps/web/app/[locale]/layout.tsx`, use `next/font/google` to load both fonts with `display: 'swap'` and `subsets: ['latin', 'latin-ext']`. The `latin-ext` subset is required for Spanish accented characters (á, é, í, ó, ú, ñ, ü).

---

## 9. Dark Mode

Dark mode is deferred to post-v1. The token names above are light-mode only. When dark mode is added, the Tailwind `darkMode: 'class'` strategy should be adopted (not `media`) to allow the studio owner to toggle independently of OS preference. The `dark:` modifier classes will be additive — no token names change.

---

## References

- WCAG 2.2 contrast checker: https://webaim.org/resources/contrastchecker/
- Plus Jakarta Sans: https://fonts.google.com/specimen/Plus+Jakarta+Sans
- Inter: https://fonts.google.com/specimen/Inter
- Lucide Icons: https://lucide.dev/
- Tailwind CSS docs: https://tailwindcss.com/docs
