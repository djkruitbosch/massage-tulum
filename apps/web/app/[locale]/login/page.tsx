/**
 * Login page — Server Component.
 *
 * Reads the `error` and `next` query params from the URL:
 *   - `error`: 'link_expired' | 'invalid_link' — passed to LoginForm
 *     to pre-show the error banner (e.g. when redirected from /auth/callback).
 *   - `next`: the URL to redirect to after login (set by middleware route
 *     protection).
 *
 * The page itself is a simple card shell. The interactive form logic lives
 * in the LoginForm client component.
 *
 * Route protection (redirect to /dashboard if already authenticated)
 * is handled by middleware.
 *
 * Ref: docs/design/CU-869d29f1f-studio-owner-auth.md §Screen 1
 * Ref: docs/design/components/LoginForm.md
 * Ticket: CU-869d4za67
 */

import { getLocale, getTranslations } from 'next-intl/server';
import { Footer } from '../_components/footer';
import { LoginForm } from './_components/login-form';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  await params;
  const { error } = await searchParams;
  const locale = await getLocale();

  const tLayout = await getTranslations('layout');
  const tLogin = await getTranslations('auth.login');
  const tLs = await getTranslations('languageSwitcher');

  const initialError = error === 'link_expired' || error === 'invalid_link' ? error : null;

  return (
    <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>

      <div className="flex min-h-screen flex-col">
        {/* HEADER */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-narrow items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <span
              className="font-heading text-xl font-bold text-brand-700"
              aria-label={tLayout('header.logoAlt')}
            >
              {tLayout('header.logoAlt')}
            </span>

            {/* Language Switcher */}
            <div role="group" aria-label={tLs('label')} className="flex items-center gap-1">
              <a
                href="/"
                aria-label={
                  locale === 'es' ? tLs('current', { locale: tLs('esTitle') }) : tLs('esTitle')
                }
                aria-current={locale === 'es' ? 'true' : undefined}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center',
                  'rounded-lg px-3 py-2 text-sm font-medium',
                  'motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  locale === 'es'
                    ? 'bg-brand-700 text-white'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100',
                ].join(' ')}
              >
                {tLs('es')}
              </a>
              <a
                href="/en/login"
                aria-label={
                  locale === 'en' ? tLs('current', { locale: tLs('enTitle') }) : tLs('enTitle')
                }
                aria-current={locale === 'en' ? 'true' : undefined}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center',
                  'rounded-lg px-3 py-2 text-sm font-medium',
                  'motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  locale === 'en'
                    ? 'bg-brand-700 text-white'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100',
                ].join(' ')}
              >
                {tLs('en')}
              </a>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12"
          role="main"
        >
          <div className="w-full max-w-narrow">
            {/* Login card */}
            <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8" aria-live="polite">
              <h1 className="font-heading text-2xl font-bold text-neutral-800 mb-1">
                {tLogin('title')}
              </h1>
              <p className="text-sm text-neutral-500 mb-6">{tLogin('subtitle')}</p>

              <LoginForm initialError={initialError} locale={locale} />
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <Footer locale={locale} />
      </div>
    </>
  );
}
