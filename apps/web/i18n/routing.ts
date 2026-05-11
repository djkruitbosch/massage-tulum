import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing configuration for next-intl.
 *
 * Routing strategy: `as-needed`
 *   - Default locale (es) is served at `/` with no prefix.
 *   - Alternate locale (en) is served at `/en`.
 *
 * This means:
 *   - `/`   → Spanish (default)
 *   - `/en` → English
 *   - `/es` → redirects to `/` (canonical path for default locale)
 *
 * Locked per research R4 and GATE-2 approvals.
 * See: docs/research/2026-04-26-foundation.md §R4
 *
 * Pathnames — localized URL slugs for specific routes (additive, non-breaking):
 *   - `/privacy` → `/aviso-de-privacidad` (es) / `/en/privacy-policy` (en)
 *
 * Adding pathnames does not affect routes not listed here.
 * See: docs/adr/0010-next-intl-localized-pathnames.md
 * Ticket: CU-869d8202d
 */
export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'as-needed',
  pathnames: {
    '/privacy': {
      es: '/aviso-de-privacidad',
      en: '/privacy-policy',
    },
  },
});
