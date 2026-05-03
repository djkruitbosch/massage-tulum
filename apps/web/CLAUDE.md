# apps/web — Next.js Frontend

This file is loaded automatically when Claude Code is working inside `apps/web/`.

---

## What this app is

Next.js 15 (App Router) frontend for the Massage Tulum studio-management platform.
Primary user: studio owners. Desktop-first, mobile-responsive.
Deployed to Vercel at `massage-tulum.dirk-jan.com`.

---

## Local development

### Prerequisites

- Node 22 LTS (see root `.nvmrc`)
- pnpm 10+ (see root `package.json`)

### First time setup

```bash
# From repo root
pnpm install

# Copy env example
cp apps/web/.env.example apps/web/.env.local
# Fill in your Supabase project values
```

### Run dev server

```bash
# From repo root (recommended — Turborepo manages deps)
pnpm --filter @massage-tulum/web dev

# Or from apps/web directly
cd apps/web && pnpm dev
```

Dev server runs on http://localhost:3000.

### Build and typecheck

```bash
pnpm --filter @massage-tulum/web build
pnpm --filter @massage-tulum/web typecheck
pnpm --filter @massage-tulum/web lint
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | NestJS API base URL (e.g. `http://localhost:3001` in dev) |

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

---

## Architecture decisions relevant to this app

| ADR | Topic |
|---|---|
| ADR-0006 | CSP via Next.js middleware — nonce-based, combined with next-intl |

Full ADR list: `docs/adr/`.

---

## Key conventions

### Routing

- App Router. All pages live in `app/[locale]/`.
- `[locale]` segment is served by next-intl (FE-2, CU-869d29n0n).
- Default locale: `es` (Spanish). Alternate: `en`.
- Locale prefix strategy: `as-needed` — Spanish served at `/`, English at `/en`.

### Internationalization

- **next-intl** (installed in FE-2, CU-869d29n0n).
- Translation files: `messages/es.json` and `messages/en.json`.
- Both files must be updated together. Never ship a string in one language only.
- Keys use dot-path namespaces matching the screen: `home.hero.title`, `layout.skipLink`, etc.
- TODOs marked `// TODO(CU-869d29n0n)` are strings waiting for next-intl integration.

### Styling

- Tailwind CSS only. No inline styles except for dynamic values.
- Design tokens in `tailwind.config.ts` (sourced from `docs/design/tokens.md`).
- Font families: `font-heading` = Plus Jakarta Sans, `font-sans` / `font-body` = Inter.
- Minimum viewport: 375px. No horizontal scroll at 375px is a non-negotiable quality bar.

### Accessibility

- Skip link on every page (see `app/globals.css` `.skip-link` class).
- Focus rings: `focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2`.
- Reduced motion: always use `motion-safe:` prefix on animations.
- `<html lang={locale}>` is set in `app/[locale]/layout.tsx`.
- See `docs/design/accessibility.md` for full baseline.

### CSP

- CSP middleware lives in `middleware.ts`. Combined with the next-intl middleware in a single function. Generates a per-request nonce and sets `Content-Security-Policy` + `x-nonce` headers on every response.
- The CSP policy itself lives in `lib/csp.ts` (`buildCsp(nonce)`). Implemented verbatim from ADR-0006; do not edit without an ADR supersession.
- Server Components that need to inline a `<script>` tag (e.g., analytics) must read the nonce: `const nonce = (await headers()).get('x-nonce') ?? ''` and pass it to the tag's `nonce` attribute. `'strict-dynamic'` propagates trust from there.
- No inline `<script>` tags without a nonce. React event handlers (onClick etc.) are CSP-safe.
- Tailwind class-based styles are CSP-safe (compiled to stylesheet rules, not inline styles).
- The `style-src 'unsafe-inline'` tradeoff is documented in ADR-0006.

### Server vs Client components

- Server Components by default.
- Add `'use client'` only when you need: state, effects, browser APIs, event handlers that must run in the browser.
- Language switcher (once built in FE-2) is a Client Component because it requires `useRouter` / `usePathname` from next-intl.

---

## Ticket cross-references

| Ticket | Work |
|---|---|
| CU-869d29n0d | This scaffold (FE-1) |
| CU-869d29n0n | next-intl integration, i18n routing, language switcher (FE-2) |
| CU-869d29n0x | CSP middleware (FE-3) |
