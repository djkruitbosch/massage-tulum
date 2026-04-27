# Component: LayoutShell

**Used in:** Foundation (all pages inherit this shell)
**Designer doc:** `docs/design/foundation-home.md`
**Status:** Spec
**Date:** 2026-04-26

---

## Purpose

The LayoutShell is the outermost page wrapper for every studio-owner UI page. It establishes the consistent structure: a top header bar, a main content area, and a minimal footer. At foundation stage, it proves the i18n routing, CSP nonce injection, and Tailwind token integration work end-to-end. The navigation links inside the header are placeholder-only at foundation stage — real navigation is designed with each feature.

---

## Anatomy

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER  (sticky, full-width, h-16)                             │
│  [ Logo placeholder ]              [ LanguageSwitcher ]          │
├─────────────────────────────────────────────────────────────────┤
│  MAIN  (flex-1, min-h-screen minus header/footer)               │
│                                                                  │
│    ┌─────────────────── container (max-w-wide) ──────────────┐  │
│    │                                                          │  │
│    │   [  page content slot  ]                               │  │
│    │                                                          │  │
│    └──────────────────────────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  FOOTER  (full-width, h-12, minimal copyright line)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Props

```typescript
interface LayoutShellProps {
  children: React.ReactNode;     // Page content — rendered in <main>
  locale: string;                // 'es' | 'en' — used for <html lang> and for passing to LanguageSwitcher
}
```

**Note:** `locale` is passed from the Next.js App Router `[locale]` segment. The root layout at `app/[locale]/layout.tsx` sets `<html lang={locale}>`. The LayoutShell itself does not own the `<html>` tag — it owns `<div>` structure below it.

---

## Structure (described for developer-fe)

```
<div className="flex min-h-screen flex-col bg-neutral-50">
  <header ...>
    <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <LogoPlaceholder />
      <div className="flex items-center gap-4">
        <LanguageSwitcher locale={locale} />
      </div>
    </div>
  </header>

  <main className="flex-1">
    <div className="container mx-auto max-w-wide px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  </main>

  <footer ...>
    <div className="container mx-auto flex h-12 items-center justify-center px-4">
      <p className="text-xs text-neutral-400">{t('footer.copyright', { year: currentYear })}</p>
    </div>
  </footer>
</div>
```

---

## Header

**Height:** 64px (`h-16`)
**Background:** `bg-white`
**Border bottom:** `border-b border-neutral-200`
**Shadow:** `shadow-sm`
**Position:** `sticky top-0 z-50` — the header sticks to the viewport top on scroll.

**Logo placeholder:** A simple text string "Massage Tulum" in `font-heading text-xl font-bold text-brand-700`. Will be replaced with an actual `<img>` or SVG logo once brand assets are provided.

**Accessible landmark:** The `<header>` element has `role="banner"` (implicit via `<header>`). On pages with navigation (future), a `<nav aria-label="Navegación principal" / "Main navigation">` wraps the nav links.

---

## Main

**flex:** `flex-1` (fills remaining height between header and footer)
**Background:** inherits `bg-neutral-50` from the outer wrapper
**Content container:** `max-w-wide` (1280px) centered with `mx-auto`, with responsive horizontal padding

---

## Footer

**Height:** 48px (`h-12`)
**Background:** `bg-white`
**Border top:** `border-t border-neutral-200`
**Content:** Copyright notice only. Centered, `text-xs text-neutral-400`.

---

## States

- **Default:** Rendered with header, main, and footer. Header is sticky.
- **Loading (page transition):** No shell animation — the shell itself is static. The `children` slot shows the skeleton or loading state.
- **Error (page-level):** The shell renders normally; the `children` slot shows the error state. The header and footer remain accessible.
- **Empty:** Not applicable to the shell itself.
- **Mobile (nav collapsed):** At foundation stage, the header shows only the logo and language switcher — there are no nav links to collapse. When navigation is added (future feature), a hamburger button will appear at `<md` breakpoints and the LanguageSwitcher moves inside the mobile menu drawer.

---

## Accessibility

- **ARIA role:** `<header>` = `banner` (implicit). `<main>` = `main` (implicit). `<footer>` = `contentinfo` (implicit).
- **Skip link:** A visually-hidden-until-focused skip link MUST appear as the very first focusable element in the DOM, before the header: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Ir al contenido / Skip to content</a>`. The `<main>` element has `id="main-content"`.
- **Keyboard:** Tab order: skip link → logo → language switcher → page content → footer. The header is sticky but does not trap focus.
- **Language attribute:** The root `<html lang={locale}>` is set in `app/[locale]/layout.tsx`. This is mandatory for correct screen reader pronunciation.

---

## Responsive Behavior

- **Desktop (≥1024px):** Full header visible. Logo left, language switcher right.
- **Tablet (768–1023px):** Same layout as desktop. Container padding reduces slightly.
- **Mobile (375–767px):** Logo and language switcher visible. Logo text may truncate to an icon/monogram in a future iteration if space is tight, but at foundation stage the text "Massage Tulum" is short enough to fit. Container padding reduces to `px-4`.

---

## Tokens Used

- **Colors:** `neutral.50` (bg.page), `white` (header/footer bg), `neutral.200` (borders), `brand.700` (logo text)
- **Spacing:** `h-16` (header), `h-12` (footer), `px-4/6/8` (container padding), `py-8` (main content padding)
- **Typography:** `text-xl font-bold font-heading` (logo), `text-xs` (footer)
- **Shadow:** `shadow-sm`
- **Z-index:** `z-50` (sticky header)

---

## Copy Keys

| Key | es | en |
|---|---|---|
| `layout.header.logoAlt` | Massage Tulum | Massage Tulum |
| `layout.skipLink` | Ir al contenido principal | Skip to main content |
| `layout.footer.copyright` | © {year} Massage Tulum. Todos los derechos reservados. | © {year} Massage Tulum. All rights reserved. |

---

## Don'ts

- Don't add page-specific navigation items here — LayoutShell is generic. Feature-specific navigation belongs in feature layout wrappers.
- Don't remove the skip link — it is an accessibility requirement.
- Don't make the header non-sticky without a documented reason — studio owners need persistent access to navigation.
- Don't put business logic in the shell — it is a pure layout wrapper.
