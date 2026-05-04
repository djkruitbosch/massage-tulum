/**
 * Locale-aware 404 page.
 *
 * Next.js App Router requires this file when using a `[locale]` dynamic
 * segment. Without it, Next.js falls back to the legacy `_error` page
 * renderer for the `/404` pre-render path, which triggers:
 *   "Html should not be imported outside of pages/_document"
 *
 * This is intentionally minimal — the content will be enhanced in a
 * future sprint when the full 404 design is specified.
 */

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function NotFoundPage() {
  const t = await getTranslations('layout');

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4"
      role="main"
    >
      <div className="text-center max-w-narrow">
        <h1 className="font-heading text-4xl font-bold text-neutral-800 mb-4">404</h1>
        <p className="text-base text-neutral-500 mb-8">{t('header.logoAlt')}</p>
        <Link
          href="/"
          className={[
            'rounded-lg bg-brand-700 px-6 py-3 text-base font-medium text-white',
            'hover:bg-brand-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
          ].join(' ')}
        >
          {/* Simple back link — copy will be refined when 404 design is spec'd */}←
        </Link>
      </div>
    </main>
  );
}
