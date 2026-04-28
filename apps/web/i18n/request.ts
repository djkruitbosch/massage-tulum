import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Server-side request configuration for next-intl.
 *
 * Loads message JSON for the request's locale. Falls back to the
 * default locale (`es`) if the request locale is missing or unknown.
 *
 * The `createMessagesDeclaration` option in next.config.ts uses
 * `messages/es.json` as the canonical key source so missing keys
 * produce TypeScript errors at build time.
 *
 * See: docs/research/2026-04-26-foundation.md §R4
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
