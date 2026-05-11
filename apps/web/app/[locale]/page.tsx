import { getTranslations } from 'next-intl/server';
import { Footer } from './_components/footer';

/**
 * Placeholder home page — Foundation sprint.
 *
 * All user-visible strings come through next-intl `getTranslations()`.
 * No hardcoded copy remains; both `messages/es.json` and `messages/en.json`
 * are the single source of truth for every string rendered here.
 *
 * This is a Server Component (no `'use client'`). `getTranslations` is the
 * idiomatic async server-side translator per next-intl v4.
 *
 * The language switcher links use plain `<a>` tags for now (no JS needed for
 * locale switching when localePrefix is `as-needed` — `/` for es, `/en` for en).
 * These will be replaced with a dedicated LanguageSwitcher Client Component in
 * a follow-up ticket once the packages/ui component library is scaffolded.
 *
 * The CTA button is disabled — it has no destination in the Foundation sprint.
 * It will be wired to the login/onboarding flow when the auth feature ships.
 *
 * See: docs/design/foundation-home.md
 */

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  const tLayout = await getTranslations('layout');
  const tHome = await getTranslations('home');
  const tLs = await getTranslations('languageSwitcher');

  return (
    <>
      {/* Skip link — visually hidden until focused via keyboard (see globals.css .skip-link) */}
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>

      {/* LayoutShell: header + main + footer */}
      <div className="flex min-h-screen flex-col">
        {/* HEADER */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-content items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10">
            {/* Logo — non-interactive text placeholder */}
            <span
              className="font-heading text-xl font-bold text-brand-700"
              aria-label={tLayout('header.logoAlt')}
            >
              {tLayout('header.logoAlt')}
            </span>

            {/* Language Switcher */}
            {/* Plain <a> links are sufficient here; a dedicated LanguageSwitcher
                Client Component will replace this in a follow-up ticket. */}
            <div role="group" aria-label={tLs('label')} className="flex items-center gap-1">
              <a
                href="/"
                aria-label={
                  locale === 'es' ? tLs('current', { locale: tLs('esTitle') }) : tLs('esTitle')
                }
                aria-current={locale === 'es' ? 'true' : undefined}
                className={
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ' +
                  'motion-safe:transition-colors motion-safe:duration-[150ms] motion-safe:ease-out ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ' +
                  (locale === 'es'
                    ? 'bg-brand-700 text-white'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100')
                }
              >
                {tLs('es')}
              </a>
              <a
                href="/en"
                aria-label={
                  locale === 'en' ? tLs('current', { locale: tLs('enTitle') }) : tLs('enTitle')
                }
                aria-current={locale === 'en' ? 'true' : undefined}
                className={
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ' +
                  'motion-safe:transition-colors motion-safe:duration-[150ms] motion-safe:ease-out ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ' +
                  (locale === 'en'
                    ? 'bg-brand-700 text-white'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100')
                }
              >
                {tLs('en')}
              </a>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main
          id="main-content"
          className="flex flex-1 items-center justify-center bg-neutral-50"
          role="main"
        >
          <div className="mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8 xl:px-10">
            <div className="flex flex-col items-center justify-center py-24">
              {/* Hero heading */}
              <h2 className="font-heading text-xl font-bold text-neutral-800 text-center sm:text-3xl">
                {tHome('hero.title')}
              </h2>

              {/* Hero subtitle */}
              <p className="mt-3 max-w-sm text-base text-neutral-500 text-center">
                {tHome('hero.subtitle')}
              </p>

              {/* CTA Button — disabled placeholder, no destination yet */}
              {/* TODO: wire to login/onboarding route once auth feature ships */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                className={
                  'mt-8 w-full rounded-lg bg-brand-700 px-6 py-3 text-base font-medium text-white sm:w-auto ' +
                  'disabled:cursor-not-allowed disabled:opacity-50 ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ' +
                  'motion-safe:transition-colors motion-safe:duration-[150ms] motion-safe:ease-out'
                }
              >
                {tHome('hero.cta')}
              </button>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <Footer locale={locale} />
      </div>
    </>
  );
}
