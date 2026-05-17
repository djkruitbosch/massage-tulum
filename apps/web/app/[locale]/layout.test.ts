/**
 * Tests for `generateMetadata` exported from `app/[locale]/layout.tsx`.
 *
 * Pins:
 *   - description switches with locale (Spanish vs English)
 *   - brand title + template are stable across locales (not translated)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub the Google Fonts loaders so the layout module can be imported in
// the Node test environment without network or font-resolution side
// effects. The loaders only need to return objects with a `variable`
// property — the layout component itself is not tested here.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  Plus_Jakarta_Sans: () => ({ variable: '--font-plus-jakarta-sans' }),
}));

// Mock `next-intl/server` to return a translator scoped to the namespace
// passed to `getTranslations` ("meta" here). Toggle the active locale
// per test via `setLocale`.
let currentLocale: 'es' | 'en' = 'es';
const setLocale = (locale: 'es' | 'en') => {
  currentLocale = locale;
};

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const messages = {
      es: {
        meta: {
          description: 'Plataforma profesional de gestión para estudios de masajes en Tulum.',
        },
      },
      en: {
        meta: {
          description: 'Professional management platform for massage studios in Tulum.',
        },
      },
    } as const;
    return (key: string) => {
      const scope = (messages[currentLocale] as Record<string, Record<string, string>>)[namespace];
      return scope?.[key] ?? `${namespace}.${key}`;
    };
  }),
  getLocale: vi.fn(async () => currentLocale),
  getMessages: vi.fn(async () => ({})),
}));

afterEach(() => {
  setLocale('es');
});

describe('layout generateMetadata', () => {
  it('returns the Spanish description when locale=es', async () => {
    setLocale('es');
    const { generateMetadata } = await import('./layout');
    const meta = await generateMetadata();
    expect(meta.description).toBe(
      'Plataforma profesional de gestión para estudios de masajes en Tulum.',
    );
  });

  it('returns the English description when locale=en', async () => {
    setLocale('en');
    const { generateMetadata } = await import('./layout');
    const meta = await generateMetadata();
    expect(meta.description).toBe('Professional management platform for massage studios in Tulum.');
  });

  it('uses the Massage Tulum brand as the default title and template', async () => {
    const { generateMetadata } = await import('./layout');
    const meta = await generateMetadata();
    const title = meta.title as { default: string; template: string };
    expect(title.default).toBe('Massage Tulum');
    expect(title.template).toBe('%s · Massage Tulum');
  });
});
