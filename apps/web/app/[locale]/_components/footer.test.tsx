// @vitest-environment jsdom
/**
 * Footer component — smoke test.
 *
 * Footer renders the LFPDPPP-required Privacy Policy link on every page.
 * Regressing the privacy href or label is a legal exposure, so this test
 * pins:
 *   - The copyright string is rendered
 *   - The privacy link points to the locale-correct canonical URL
 *     (/aviso-de-privacidad for es, /en/privacy-policy for en)
 *   - The privacy link uses the localized label key from messages
 *
 * Server-component test pattern: `Footer` is an `async function`, so we
 * await it to resolve the JSX, then render the returned element.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Footer } from './footer';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async ({ locale }: { locale: string }) => {
    return (key: string, vars?: Record<string, string>) => {
      const en: Record<string, string> = {
        'footer.copyright': `© ${vars?.year ?? ''} Massage Tulum. All rights reserved.`,
        'footer.privacyLink': 'Privacy Policy',
      };
      const es: Record<string, string> = {
        'footer.copyright': `© ${vars?.year ?? ''} Massage Tulum. Todos los derechos reservados.`,
        'footer.privacyLink': 'Aviso de Privacidad',
      };
      return (locale === 'en' ? en : es)[key] ?? key;
    };
  }),
}));

afterEach(() => {
  cleanup();
});

describe('Footer', () => {
  it('renders Spanish copyright and links to /aviso-de-privacidad when locale=es', async () => {
    const ui = await Footer({ locale: 'es' });
    render(ui);

    const link = screen.getByRole('link', { name: 'Aviso de Privacidad' });
    expect(link).toHaveAttribute('href', '/aviso-de-privacidad');
    expect(screen.getByText(/Todos los derechos reservados/)).toBeInTheDocument();
  });

  it('renders English copyright and links to /en/privacy-policy when locale=en', async () => {
    const ui = await Footer({ locale: 'en' });
    render(ui);

    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/en/privacy-policy');
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });

  it('uses the current year in the copyright', async () => {
    const ui = await Footer({ locale: 'es' });
    render(ui);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(String(currentYear)))).toBeInTheDocument();
  });

  it('marks the footer with the contentinfo landmark role', async () => {
    const ui = await Footer({ locale: 'es' });
    render(ui);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
