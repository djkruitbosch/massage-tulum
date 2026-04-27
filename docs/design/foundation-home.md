# Design: Foundation — Placeholder Home Page

**Spec:** https://app.clickup.com/9012175939/docs/8cjnt23-12272
**Ticket:** CU-869d29f0x
**Date:** 2026-04-26
**Author:** designer (agent)

---

## Purpose

This page is a placeholder to verify that the following subsystems work end-to-end before any real feature is built:

1. Next.js App Router + `[locale]` segment renders correctly.
2. next-intl `localePrefix: 'as-needed'` serves Spanish at `/` and English at `/en/`.
3. Language switcher navigates between locales and preserves the current route.
4. Tailwind tokens (colors, typography, spacing) render correctly in the browser.
5. CSP middleware generates a nonce per request and `style-src 'unsafe-inline'` allows Tailwind styles.
6. `<html lang>` attribute is set correctly per locale.
7. The `packages/ui` Button component stub renders and is keyboard-accessible.

This page does NOT represent the final marketing or onboarding design. Remove or replace it when the real authenticated experience is built.

---

## 1. Screens Involved

### Screen: Placeholder Home

- **URL (es):** `/` — serves Spanish by default (no locale prefix per `localePrefix: 'as-needed'`)
- **URL (en):** `/en` — explicit English locale prefix
- **Primary user goal:** Confirm the app is running; switch language; see that tokens are applied.
- **Layout:** LayoutShell (header + main + footer). No sidebar. No navigation. Single column centered.

---

## 2. User Flows

### Flow: Arrive at home (Spanish default)

1. User opens browser to the root URL `/`.
2. Next.js middleware detects no locale prefix; serves Spanish content (default locale).
3. Page renders with `<html lang="es">`.
4. LayoutShell header shows logo placeholder ("Massage Tulum") and LanguageSwitcher with ES active.
5. Main content shows the hero section in Spanish.
6. Footer shows copyright notice.

### Flow: Switch to English

1. User clicks the "EN" button in the LanguageSwitcher.
2. next-intl navigation redirects to `/en`.
3. Page re-renders with `<html lang="en">`.
4. All text switches to English.
5. LanguageSwitcher shows EN active.

### Flow: Switch back to Spanish

1. User clicks "ES" in the LanguageSwitcher while on `/en`.
2. next-intl navigates to `/` (strips the `/en` prefix).
3. Page re-renders with `<html lang="es">`.

### Flow: Keyboard navigation

1. User tabs from browser chrome into page.
2. First focus: skip link ("Ir al contenido principal" / "Skip to main content").
3. Pressing Enter/Space on skip link jumps focus to `<main id="main-content">`.
4. Next Tab from the start: logo (non-interactive, skipped), LanguageSwitcher ES button, LanguageSwitcher EN button, then main content (demo Button), then footer (no interactive elements).

---

## 3. Component Inventory

| Component | Source | Notes |
|---|---|---|
| `LayoutShell` | New — `docs/design/components/LayoutShell.md` | Header, main, footer wrapper |
| `LanguageSwitcher` | New — `docs/design/components/LanguageSwitcher.md` | ES/EN toggle in header |
| `Button` | New — `docs/design/components/Button.md` | Demo button in hero (proves `packages/ui` stub works) |

No existing components to reuse (this is the foundation — inventory starts here).

---

## 4. New Components

All new components for this feature are fully specified in their own files under `docs/design/components/`. See:
- `Button.md`
- `LayoutShell.md`
- `LanguageSwitcher.md`
- `LoadingSkeleton.md`
- `Toast.md`

The placeholder home page itself uses Button, LayoutShell, and LanguageSwitcher.

---

## 5. Wireframe — Placeholder Home Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  [skip link — visually hidden, focused on Tab]                       │
├─────────────────────────────────────────────────────────────────────┤
│  HEADER  bg-white border-b border-neutral-200 shadow-sm  h-16       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  [ Massage Tulum ]  (font-heading, text-xl, text-brand-700) │    │
│  │                                            [ ES | EN ]      │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN  bg-neutral-50  flex-1                                        │
│                                                                      │
│    ┌──────────────── max-w-content (960px) mx-auto px-4 ──────┐     │
│    │                                                            │     │
│    │                                                            │     │
│    │   (vertical centering: flex flex-col items-center         │     │
│    │    justify-center  min-h approx 60vh)                      │     │
│    │                                                            │     │
│    │   ┌────────────────────────────────────────┐              │     │
│    │   │                                        │              │     │
│    │   │  Bienvenido a Massage Tulum            │              │     │
│    │   │  (h2, font-heading, text-3xl/bold,     │              │     │
│    │   │   text-neutral-800, text-center)       │              │     │
│    │   │                                        │              │     │
│    │   │  Gestión profesional para tu estudio   │              │     │
│    │   │  de masajes.                           │              │     │
│    │   │  (body, text-base, text-neutral-500,   │              │     │
│    │   │   text-center, mt-3, max-w-sm)         │              │     │
│    │   │                                        │              │     │
│    │   │  [ Comenzar — Button primary/md ]      │              │     │
│    │   │   mt-8, disabled (placeholder only)    │              │     │
│    │   │                                        │              │     │
│    │   └────────────────────────────────────────┘              │     │
│    │                                                            │     │
│    └────────────────────────────────────────────────────────────┘     │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  FOOTER  bg-white border-t border-neutral-200  h-12                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │    © 2026 Massage Tulum. Todos los derechos reservados.     │    │
│  │    (text-xs, text-neutral-400, text-center)                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**
- The hero section is vertically centered within the main area using flexbox on `<main>`.
- Max-width of the content container: `max-w-[960px]` (the `content` container token).
- The "Comenzar" / "Get Started" button is `variant="primary" size="md" disabled`. It is disabled because it has no destination in the foundation sprint. A future feature will wire it to the login/onboarding flow.
- No illustrations, background images, or decorative elements. Clean, white-on-sand. The goal is proving the stack, not impressing users.

---

## 6. Page-Level States

### Loading

The placeholder home page has no async data fetch. It renders immediately as a Server Component. No skeleton needed. If the Next.js dev server is slow on first load, the browser shows a blank white page — this is the browser's default behavior and not a UX concern for the placeholder.

### Error

If the page itself fails to render (server-side error), Next.js App Router shows the nearest `error.tsx` boundary. At foundation stage, design a minimal error page:

```
Header (LayoutShell header)
─────────────────────────────
  [!] Algo salió mal. / Something went wrong.
      Por favor recarga la página.  /  Please reload the page.
      [ Recargar / Reload — Button secondary/md ]
Footer (LayoutShell footer)
```

### Empty

Not applicable — this is a static placeholder page with no data.

---

## 7. Interaction and Motion

- Language switcher: `motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out` on the switching button.
- Page navigation on locale switch: full page reload via Next.js navigation. No transition animation at v1.
- No other interactive elements on the placeholder page.

---

## 8. Accessibility Checklist

- [x] Keyboard reachable — skip link, language switcher, and demo button are all tab-reachable
- [x] Focus visible — all interactive elements use `focus-visible:ring-2` Tailwind classes
- [x] Color contrast — `neutral.700 (#343A40)` on `neutral.50 (#F8F9FA)`: ~10.6:1. `neutral.500` on white: ~4.6:1. Both pass WCAG 2.2 AA.
- [x] Screen reader labels — language switcher `role="group"` with `aria-label`; dismiss button has `aria-label`; skip link has descriptive text
- [x] No information conveyed by color alone — language switcher shows both text abbreviation and filled/outlined state
- [x] `<html lang>` set correctly per locale — `es` at `/`, `en` at `/en`
- [x] Reduced motion — LanguageSwitcher uses `motion-safe:` modifier; no page-level animations to suppress

---

## 9. Responsive Notes

- **Desktop (≥1024px):** Hero centered in content container. Button is `md` size. Language switcher in header right slot.
- **Tablet (768–1023px):** Same layout. Container padding reduces to `px-6`.
- **Mobile (375–767px):** Container padding `px-4`. Hero text reduces to `text-2xl` via `sm:text-3xl` (mobile-first override within desktop-first framework). The "Comenzar" button becomes `fullWidth` on mobile. Language switcher remains in the header.

**Non-negotiable mobile check:** At 375px viewport width, verify there is no horizontal scroll bar. The `max-w-[960px] mx-auto px-4` container ensures this.

---

## 10. CSP Testing Note

The language switcher uses a React `onClick` event handler (not an inline HTML `onclick` attribute). This is CSP-compliant — React's synthetic event system does not emit inline event attributes in the rendered HTML. When verifying CSP in the browser:

1. Open browser DevTools → Console.
2. Navigate to `/` and `/en`.
3. Confirm no CSP violation errors appear in the console.
4. Confirm the `Content-Security-Policy` header is present in Network tab → document response.
5. Confirm `style-src 'unsafe-inline'` is present (required for Tailwind JIT).
6. Confirm no `'unsafe-eval'` appears in the CSP header.

---

## 11. Copy — `messages/es.json` and `messages/en.json`

All strings below must be added simultaneously to both files before developer-fe implements the page.

### `home.*` namespace

| Key | es | en |
|---|---|---|
| `home.hero.title` | Bienvenido a Massage Tulum | Welcome to Massage Tulum |
| `home.hero.subtitle` | Gestión profesional para tu estudio de masajes. | Professional management for your massage studio. |
| `home.hero.cta` | Comenzar | Get Started |

### `layout.*` namespace

| Key | es | en |
|---|---|---|
| `layout.header.logoAlt` | Massage Tulum | Massage Tulum |
| `layout.skipLink` | Ir al contenido principal | Skip to main content |
| `layout.footer.copyright` | © {year} Massage Tulum. Todos los derechos reservados. | © {year} Massage Tulum. All rights reserved. |

### `languageSwitcher.*` namespace

| Key | es | en |
|---|---|---|
| `languageSwitcher.label` | Seleccionar idioma | Select language |
| `languageSwitcher.es` | ES | ES |
| `languageSwitcher.en` | EN | EN |
| `languageSwitcher.es.title` | Español | Spanish |
| `languageSwitcher.en.title` | Inglés | English |
| `languageSwitcher.current` | Idioma actual: {locale} | Current language: {locale} |

### `common.*` namespace (foundation-level strings)

| Key | es | en |
|---|---|---|
| `common.loading.generic` | Cargando... | Loading... |
| `common.button.loading` | Cargando... | Loading... |
| `common.button.retry` | Reintentar | Retry |
| `common.button.cancel` | Cancelar | Cancel |
| `common.button.save` | Guardar | Save |
| `common.button.delete` | Eliminar | Delete |
| `common.button.confirm` | Confirmar | Confirm |
| `common.button.close` | Cerrar | Close |
| `common.error.title` | Algo salió mal | Something went wrong |
| `common.error.body` | Por favor recarga la página. | Please reload the page. |
| `common.error.reload` | Recargar | Reload |

### `toast.*` namespace

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

## 12. Open Questions for GATE 2

1. **Brand palette:** The palette (warm terracotta/sand + cool grays) is a designer-authored proposal. Does the studio owner have an existing logo, brand color, or visual direction? If so, the primary brand colors in `tokens.md` should be updated before implementation.

2. **Logo:** Currently a text placeholder ("Massage Tulum" in brand-700). Will an SVG or image logo be provided? If so, what are the dimensions/format constraints?

3. **"Comenzar" CTA destination:** The hero CTA button is disabled at foundation stage. What is the intended destination? (Likely the login/magic link screen, which comes in a future feature.) Confirm so the link can be wired correctly when that feature ships.

4. **Footer content:** Currently just a copyright line. Should the footer include any links (e.g., privacy policy, terms) at launch? These need copy in both languages.

5. **Dark mode timeline:** Dark mode is noted as deferred. Should it be noted as a v2 roadmap item so the token naming convention is locked from the start?
