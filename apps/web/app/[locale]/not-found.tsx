/**
 * Locale-aware 404 page.
 *
 * Next.js App Router requires this file when using a `[locale]` dynamic
 * segment. Without it, Next.js falls back to the legacy `_error` page
 * renderer for the `/404` pre-render path, which triggers:
 *   "Html should not be imported outside of pages/_document"
 *
 * Copy lives in `messages/{es,en}.json` under `common.notFound`.
 *
 * Note: we intentionally do NOT call `getLocale()` here. During the static
 * `/404` pre-render the request context is absent, so `getLocale()` can
 * throw or return the wrong locale. The home link points at `/`; the
 * next-intl middleware will route the user to their preferred locale based
 * on Accept-Language and the existing locale prefix.
 */

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function NotFoundPage() {
  const tLayout = await getTranslations('layout');
  const tNotFound = await getTranslations('common.notFound');

  return (
    <>
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>

      <main
        id="main-content"
        className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4"
        role="main"
      >
        <div className="text-center max-w-narrow">
          {/* Decorative status code — not localised; aria-hidden so the heading carries the meaning */}
          <p className="font-heading text-5xl font-bold text-brand-700 mb-2" aria-hidden="true">
            404
          </p>
          <h1 className="font-heading text-2xl font-bold text-neutral-800 mb-3 sm:text-3xl">
            {tNotFound('title')}
          </h1>
          <p className="text-base text-neutral-500 mb-8">{tNotFound('body')}</p>
          <Link
            href="/"
            className={[
              'inline-flex items-center justify-center rounded-lg bg-brand-700 px-6 py-3 text-base font-medium text-white',
              'hover:bg-brand-600 active:bg-brand-800',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
              'motion-safe:transition-colors motion-safe:duration-[150ms] motion-safe:ease-out',
            ].join(' ')}
          >
            {tNotFound('cta')}
          </Link>
        </div>
      </main>
    </>
  );
}
