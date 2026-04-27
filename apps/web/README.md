# @massage-tulum/web

Next.js 15 (App Router) frontend for the Massage Tulum studio-management platform.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS with custom design tokens
- **Fonts:** Plus Jakarta Sans (headings) + Inter (body) via `next/font/google`
- **Icons:** Lucide React
- **i18n:** next-intl — Spanish (default) + English

## Getting started

```bash
# Install from repo root
pnpm install

# Copy env file
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_BASE_URL

# Start dev server (from repo root)
pnpm --filter @massage-tulum/web dev
```

Open http://localhost:3000 (Spanish) or http://localhost:3000/en (English).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server (requires build first) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type check (no emit) |

## Project structure

```
apps/web/
├── app/
│   └── [locale]/          # next-intl locale segment
│       ├── layout.tsx     # Root layout (fonts, <html lang>)
│       ├── page.tsx       # Placeholder home page
│       └── error.tsx      # Error boundary
├── messages/
│   ├── es.json            # Spanish translations (default locale)
│   └── en.json            # English translations
├── public/                # Static assets
├── globals.css            # Tailwind directives + base reset
├── tailwind.config.ts     # Design tokens
├── postcss.config.js
├── next.config.ts
├── tsconfig.json
├── .env.example
└── CLAUDE.md              # Agent context (local dev notes)
```

## Design system

Design tokens live in `tailwind.config.ts` and are sourced from `docs/design/tokens.md`.
Accessibility baseline: `docs/design/accessibility.md`.
Responsive strategy: `docs/design/responsive.md`.

## Localization

- Default locale: Spanish (`es`) — served at `/`
- Alternate locale: English (`en`) — served at `/en`
- Translation files: `messages/es.json` and `messages/en.json`
- Both files must be updated simultaneously — never ship a string in one language only

## Related tickets

- **FE-1 (CU-869d29n0d):** This scaffold
- **FE-2 (CU-869d29n0n):** next-intl integration + language switcher
- **FE-3 (CU-869d29n0x):** CSP middleware
