'use client';

/**
 * Error boundary page for the [locale] segment.
 *
 * This is a Client Component (required by Next.js App Router — error.tsx must
 * be a Client Component to use the `reset` callback).
 *
 * Translations are accessed via `useTranslations` (synchronous hook, valid
 * in Client Components when NextIntlClientProvider wraps the tree in layout.tsx).
 *
 * Strings: common.error.title, common.error.body, common.error.reload
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useTranslations('common.error');

  useEffect(() => {
    // Log error to console in dev; replace with error reporting service post-launch.
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal header — LayoutShell not usable here since error may be in layout */}
      <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-content items-center px-4 sm:px-6 lg:px-8">
          <span className="font-heading text-xl font-bold text-brand-700">Massage Tulum</span>
        </div>
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-neutral-50"
        role="main"
      >
        <div className="mx-auto flex max-w-narrow flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
          {/* Error icon — decorative, aria-hidden */}
          <span className="text-4xl" aria-hidden="true">
            !
          </span>

          <h2 className="font-heading text-xl font-bold text-neutral-800 sm:text-2xl">
            {t('title')}
          </h2>

          <p className="text-base text-neutral-500">{t('body')}</p>

          <button
            type="button"
            onClick={reset}
            className={
              'rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-700 ' +
              'hover:bg-neutral-50 ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ' +
              'motion-safe:transition-colors motion-safe:duration-[150ms] motion-safe:ease-out'
            }
          >
            {t('reload')}
          </button>
        </div>
      </main>

      <footer className="h-12 border-t border-neutral-200 bg-white" role="contentinfo">
        <div className="mx-auto flex h-full max-w-content items-center justify-center px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} Massage Tulum
          </p>
        </div>
      </footer>
    </div>
  );
}
