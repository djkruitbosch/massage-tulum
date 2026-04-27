// TODO(CU-869d29n0n): Replace all inline English strings with t() calls from next-intl (FE-2).
// Strings are listed in docs/design/foundation-home.md §11 with their translation keys.
// Keys needed:
//   layout.skipLink, layout.header.logoAlt, layout.footer.copyright,
//   languageSwitcher.label, languageSwitcher.es, languageSwitcher.en,
//   languageSwitcher.es.title, languageSwitcher.en.title, languageSwitcher.current,
//   home.hero.title, home.hero.subtitle, home.hero.cta

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Skip link — visually hidden until focused via keyboard */}
      {/* TODO(CU-869d29n0n): replace string with t('layout.skipLink') */}
      <a href="#main-content" className="skip-link">
        {locale === 'es' ? 'Ir al contenido principal' : 'Skip to main content'}
      </a>

      {/* LayoutShell: header + main + footer */}
      <div className="flex min-h-screen flex-col">

        {/* HEADER */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-content items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10">

            {/* Logo — non-interactive text placeholder */}
            {/* TODO(CU-869d29n0n): replace string with t('layout.header.logoAlt') */}
            <span
              className="font-heading text-xl font-bold text-brand-700"
              aria-label={locale === 'es' ? 'Massage Tulum' : 'Massage Tulum'}
            >
              Massage Tulum
            </span>

            {/* Language Switcher */}
            {/* TODO(CU-869d29n0n): replace with LanguageSwitcher component using next-intl routing (FE-2) */}
            {/* TODO(CU-869d29n0n): replace strings with t('languageSwitcher.*') keys */}
            <div
              role="group"
              aria-label={locale === 'es' ? 'Seleccionar idioma' : 'Select language'}
              className="flex items-center gap-1"
            >
              <a
                href="/"
                aria-label={locale === 'es' ? 'Idioma actual: Español' : 'Español'}
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
                ES
              </a>
              <a
                href="/en"
                aria-label={locale === 'es' ? 'Inglés' : 'Current language: English'}
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
                EN
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
              {/* TODO(CU-869d29n0n): replace with t('home.hero.title') */}
              <h2 className="font-heading text-xl font-bold text-neutral-800 text-center sm:text-3xl">
                {locale === 'es'
                  ? 'Bienvenido a Massage Tulum'
                  : 'Welcome to Massage Tulum'}
              </h2>

              {/* Hero subtitle */}
              {/* TODO(CU-869d29n0n): replace with t('home.hero.subtitle') */}
              <p className="mt-3 max-w-sm text-base text-neutral-500 text-center">
                {locale === 'es'
                  ? 'Gestión profesional para tu estudio de masajes.'
                  : 'Professional management for your massage studio.'}
              </p>

              {/* CTA Button — disabled placeholder, no destination yet */}
              {/* TODO(CU-869d29n0n): replace label with t('home.hero.cta') */}
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
                {locale === 'es' ? 'Comenzar' : 'Get Started'}
              </button>

            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer
          className="h-12 border-t border-neutral-200 bg-white"
          role="contentinfo"
        >
          <div className="mx-auto flex h-full max-w-content items-center justify-center px-4 sm:px-6 lg:px-8 xl:px-10">
            {/* TODO(CU-869d29n0n): replace with t('layout.footer.copyright', { year: currentYear }) */}
            <p className="text-xs text-neutral-400 text-center">
              {locale === 'es'
                ? `© ${currentYear} Massage Tulum. Todos los derechos reservados.`
                : `© ${currentYear} Massage Tulum. All rights reserved.`}
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}
