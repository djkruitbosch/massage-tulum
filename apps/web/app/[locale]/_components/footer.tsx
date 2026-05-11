/**
 * Shared Footer component for LayoutShell pages.
 *
 * Renders the copyright notice and the Privacy Policy link (LFPDPPP Art. 21 —
 * the integral notice must be "permanently available through the electronic
 * means available to the Responsable").
 *
 * Layout:
 *   - Desktop (≥1024px): copyright · Privacy link on one row, centered
 *   - Mobile (375px): flex-wrap allows two centered lines if content overflows
 *
 * The footer height is `h-auto min-h-12` (not the original `h-12`) so it
 * can grow to two lines on narrow viewports without clipping content.
 *
 * The Privacy link uses a plain <a> tag (not next-intl typed Link) because:
 *   1. This is a Server Component shared across all pages.
 *   2. The locale is passed as a prop, so the correct href is resolved here.
 *   3. The page-level link targets are canonical localized paths.
 *
 * See: docs/design/components/LayoutShell.md §Addendum: Footer Privacy Link
 * Ticket: CU-869d8202d
 */

import { getTranslations } from 'next-intl/server';

interface FooterProps {
  locale: string;
}

export async function Footer({ locale }: FooterProps) {
  const tLayout = await getTranslations({ locale, namespace: 'layout' });
  const currentYear = new Date().getFullYear();

  const privacyHref = locale === 'en' ? '/en/privacy-policy' : '/aviso-de-privacidad';

  return (
    <footer className="h-auto min-h-12 border-t border-neutral-200 bg-white" role="contentinfo">
      <div className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3">
        <p className="text-xs text-neutral-400 text-center">
          {tLayout('footer.copyright', { year: String(currentYear) })}
        </p>
        <span className="text-neutral-300 text-xs" aria-hidden="true">
          &middot;
        </span>
        <a
          href={privacyHref}
          className={[
            'text-xs text-neutral-500 hover:text-brand-600',
            'underline-offset-2 hover:underline',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-sm',
            'motion-safe:transition-colors motion-safe:duration-150',
          ].join(' ')}
        >
          {tLayout('footer.privacyLink')}
        </a>
      </div>
    </footer>
  );
}
