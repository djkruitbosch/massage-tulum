'use client';

// TODO(CU-869d29n0n): replace inline strings with t() calls from next-intl (FE-2).
// Keys: common.error.title, common.error.body, common.error.reload

import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to console in dev; replace with error reporting service post-launch.
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal header — LayoutShell not usable here since error may be in layout */}
      <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-content items-center px-4 sm:px-6 lg:px-8">
          <span className="font-heading text-xl font-bold text-brand-700">
            Massage Tulum
          </span>
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

          {/* TODO(CU-869d29n0n): replace with t('common.error.title') */}
          <h2 className="font-heading text-xl font-bold text-neutral-800 sm:text-2xl">
            Something went wrong
          </h2>

          {/* TODO(CU-869d29n0n): replace with t('common.error.body') */}
          <p className="text-base text-neutral-500">
            Please reload the page.
          </p>

          {/* TODO(CU-869d29n0n): replace label with t('common.error.reload') */}
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
            Reload
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
