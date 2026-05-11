/**
 * Privacy Policy page — Server Component, statically generated.
 *
 * Serves as the integral Aviso de Privacidad (LFPDPPP 2025, Article 21).
 * Rendered at two canonical URLs via next-intl localized pathnames:
 *   - /aviso-de-privacidad    (es, default locale)
 *   - /en/privacy-policy      (en)
 *
 * Non-canonical paths (/privacy-policy, /en/aviso-de-privacidad,
 * /es/aviso-de-privacidad) are redirected 308 in middleware.ts.
 *
 * This page is statically generated (`force-static`). No client-side JS
 * is needed to display content — pure Server Component per AC-13, AC-14.
 *
 * generateMetadata includes manual hreflang alternate links because
 * next-intl does not auto-generate them for localized pathnames.
 * See: docs/adr/0010-next-intl-localized-pathnames.md
 *
 * The ARCO contact email is a real <a href="mailto:..."> element per AC-15c.
 *
 * Section body copy keys contain [BLOCKING — final wording requires Mexican
 * DPA lawyer review per OQ-6 deferral]. These must be replaced before UAT.
 *
 * Ref: docs/specs/CU-869d4z2zw-privacy-policy.md §3 AC-1 through AC-15
 * Ref: docs/design/CU-869d4z2zw-privacy-policy.md
 * Ref: docs/design/components/PrivacyPolicyPage.md
 * Ticket: CU-869d8202d
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

/**
 * Effective date: the date this privacy page first shipped (2026-05-10).
 * The design doc §14 open-question 4 distinguishes between the date the
 * LFPDPPP came into force vs. the date this specific Aviso went live.
 * The translation keys carry the human-readable value per locale; this
 * constant is kept for reference and audit trail.
 */
const EFFECTIVE_DATE = '2026-05-10';
void EFFECTIVE_DATE; // exported for reference; suppress unused-variable lint

const PRIVACY_CANONICAL: Record<string, string> = {
  es: 'https://massage-tulum.dirk-jan.com/aviso-de-privacidad',
  en: 'https://massage-tulum.dirk-jan.com/en/privacy-policy',
};

const ARCO_EMAIL = 'privacy@massage-tulum.dirk-jan.com';

interface PrivacyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy.meta' });

  return {
    title: t('title'),
    description: t('description'),
    robots: { index: true, follow: true },
    alternates: {
      canonical: PRIVACY_CANONICAL[locale] ?? PRIVACY_CANONICAL.es,
      // Manual hreflang — next-intl does not auto-generate for localized pathnames.
      // See: docs/adr/0010-next-intl-localized-pathnames.md
      languages: {
        es: PRIVACY_CANONICAL.es,
        en: PRIVACY_CANONICAL.en,
      },
    },
  };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  const tLayout = await getTranslations({ locale, namespace: 'layout' });
  const tPrivacy = await getTranslations({ locale, namespace: 'privacy' });

  const currentYear = new Date().getFullYear();

  // TOC entries — matches the 10 LFPDPPP sections in render order
  const tocEntries = [
    { href: '#section-controller', label: tPrivacy('section.controller.heading') },
    { href: '#section-data-categories', label: tPrivacy('section.dataCategories.heading') },
    { href: '#section-purposes', label: tPrivacy('section.purposes.heading') },
    { href: '#section-lawful-basis', label: tPrivacy('section.lawfulBasis.heading') },
    { href: '#section-retention', label: tPrivacy('section.retention.heading') },
    { href: '#section-transfers', label: tPrivacy('section.transfers.heading') },
    { href: '#section-arco', label: tPrivacy('section.arco.heading') },
    { href: '#section-cookies', label: tPrivacy('section.cookies.heading') },
    { href: '#section-changes', label: tPrivacy('section.changes.heading') },
    { href: '#section-effective-date', label: tPrivacy('section.effectiveDate.label') },
  ];

  return (
    <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>

      {/* Print stylesheet — legal documents are frequently saved as PDF.
          Using a <style> tag here requires no nonce (style-src 'unsafe-inline'
          is already permitted per ADR-0006 tradeoff). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              header, footer, .toc-sidebar, .toc-mobile { display: none !important; }
              body, main { background: white !important; }
              .content-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
              .prose-content { max-width: 100% !important; }
              a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: #555; }
              h2, h3 { page-break-after: avoid; }
              section { page-break-inside: avoid; }
              body { font-size: 11pt; line-height: 1.5; }
              h1 { font-size: 20pt; }
              h2 { font-size: 15pt; }
              h3 { font-size: 13pt; }
            }
            @media (prefers-reduced-motion: reduce) {
              html { scroll-behavior: auto; }
            }
          `,
        }}
      />

      <div className="flex min-h-screen flex-col bg-neutral-50">
        {/* HEADER */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm sticky top-0 z-50">
          <div className="mx-auto flex h-full max-w-[960px] items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <a
              href={locale === 'en' ? '/en' : '/'}
              className={[
                'font-heading text-xl font-bold text-brand-700',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded',
              ].join(' ')}
            >
              {tLayout('header.logoAlt')}
            </a>

            {/* Language Switcher — plain <a> links since the page uses
                force-static and the switcher needs no JS for this page.
                ADR-0010: switcher must use next-intl's usePathname() in
                a Client Component to work correctly on localized paths.
                For this Server Component page, we use direct href links to
                the canonical paths — correct and simple. */}
            <nav
              aria-label={locale === 'en' ? 'Language' : 'Idioma'}
              className="flex items-center gap-1"
            >
              <a
                href="/aviso-de-privacidad"
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
                ES
              </a>
              <a
                href="/en/privacy-policy"
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
                EN
              </a>
            </nav>
          </div>
        </header>

        {/* MAIN */}
        <main id="main-content" className="flex-1 bg-neutral-50" role="main">
          <div className="content-container mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10">
            {/* Article wraps the entire document — ARIA landmark for screen readers */}
            <article aria-label={tPrivacy('page.title')}>
              {/* Page header block */}
              <header className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-neutral-800 sm:text-4xl">
                  {tPrivacy('page.title')}
                </h1>
                <p className="text-sm text-neutral-500 mt-2">
                  {tPrivacy('page.lastUpdated', {
                    date: tPrivacy('section.effectiveDate.value'),
                  })}
                </p>
              </header>

              {/* Two-column layout: sidebar TOC (desktop) + content */}
              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
                {/* Desktop: sticky sidebar TOC */}
                <aside className="toc-sidebar hidden lg:block" aria-label={tPrivacy('toc.label')}>
                  <nav
                    aria-label={tPrivacy('toc.label')}
                    className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto"
                  >
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                      {tPrivacy('toc.label')}
                    </p>
                    <ol className="space-y-1">
                      {tocEntries.map((entry) => (
                        <li key={entry.href}>
                          <a
                            href={entry.href}
                            className={[
                              'block text-sm text-neutral-600 py-1',
                              'hover:text-brand-700',
                              'motion-safe:transition-colors motion-safe:duration-150',
                              'focus-visible:outline-none focus-visible:ring-2',
                              'focus-visible:ring-brand-600 focus-visible:ring-offset-1 rounded-sm',
                            ].join(' ')}
                          >
                            {entry.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </aside>

                {/* Mobile: collapsible TOC above content */}
                <details
                  className="toc-mobile lg:hidden mb-8 border border-neutral-200 rounded-lg p-4"
                  open
                >
                  <summary className="text-sm font-medium text-neutral-700 cursor-pointer list-none flex justify-between items-center">
                    {tPrivacy('toc.label')}
                    <span aria-hidden="true" className="text-neutral-400">
                      &#9662;
                    </span>
                  </summary>
                  <nav aria-label={tPrivacy('toc.label')} className="mt-3">
                    <ol className="space-y-2">
                      {tocEntries.map((entry) => (
                        <li key={entry.href}>
                          <a
                            href={entry.href}
                            className={[
                              'block text-sm text-neutral-600 py-0.5',
                              'hover:text-brand-700',
                              'motion-safe:transition-colors motion-safe:duration-150',
                              'focus-visible:outline-none focus-visible:ring-2',
                              'focus-visible:ring-brand-600 focus-visible:ring-offset-1 rounded-sm',
                            ].join(' ')}
                          >
                            {entry.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </details>

                {/* Prose content — all 10 LFPDPPP sections */}
                <div
                  className="prose-content overflow-wrap-anywhere"
                  style={{ overflowWrap: 'break-word' }}
                >
                  {/* Section 1 — Responsable del Tratamiento / Data Controller */}
                  <section id="section-controller" aria-labelledby="heading-controller">
                    <h2
                      id="heading-controller"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-0 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.controller.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.controller.body')}
                    </p>
                  </section>

                  {/* Section 2 — Datos Personales / Personal Data */}
                  <section id="section-data-categories" aria-labelledby="heading-data-categories">
                    <h2
                      id="heading-data-categories"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.dataCategories.heading')}
                    </h2>

                    <section aria-labelledby="heading-studio-owner">
                      <h3
                        id="heading-studio-owner"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.dataCategories.studioOwner.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.dataCategories.studioOwner.body')}
                      </p>
                    </section>

                    <section aria-labelledby="heading-therapist">
                      <h3
                        id="heading-therapist"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.dataCategories.therapist.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.dataCategories.therapist.body')}
                      </p>
                    </section>
                  </section>

                  {/* Section 3 — Finalidades / Purposes */}
                  <section id="section-purposes" aria-labelledby="heading-purposes">
                    <h2
                      id="heading-purposes"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.purposes.heading')}
                    </h2>

                    <section aria-labelledby="heading-purposes-primary">
                      <h3
                        id="heading-purposes-primary"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.purposes.primary.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.purposes.primary.body')}
                      </p>
                    </section>

                    <section aria-labelledby="heading-purposes-secondary">
                      <h3
                        id="heading-purposes-secondary"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.purposes.secondary.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.purposes.secondary.body')}
                      </p>
                    </section>
                  </section>

                  {/* Section 4 — Base Legal / Lawful Basis */}
                  <section id="section-lawful-basis" aria-labelledby="heading-lawful-basis">
                    <h2
                      id="heading-lawful-basis"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.lawfulBasis.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.lawfulBasis.body')}
                    </p>
                  </section>

                  {/* Section 5 — Conservación / Retention */}
                  <section id="section-retention" aria-labelledby="heading-retention">
                    <h2
                      id="heading-retention"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.retention.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.retention.body')}
                    </p>
                  </section>

                  {/* Section 6 — Transferencias / Transfers */}
                  <section id="section-transfers" aria-labelledby="heading-transfers">
                    <h2
                      id="heading-transfers"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.transfers.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.transfers.body')}
                    </p>
                  </section>

                  {/* Section 7 — Derechos ARCO / ARCO Rights */}
                  <section id="section-arco" aria-labelledby="heading-arco">
                    <h2
                      id="heading-arco"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.arco.heading')}
                    </h2>

                    <section aria-labelledby="heading-arco-access">
                      <h3
                        id="heading-arco-access"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.arco.access.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.arco.access.body')}
                      </p>
                    </section>

                    <section aria-labelledby="heading-arco-rectification">
                      <h3
                        id="heading-arco-rectification"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.arco.rectification.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.arco.rectification.body')}
                      </p>
                    </section>

                    <section aria-labelledby="heading-arco-cancellation">
                      <h3
                        id="heading-arco-cancellation"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.arco.cancellation.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.arco.cancellation.body')}
                      </p>
                    </section>

                    <section aria-labelledby="heading-arco-opposition">
                      <h3
                        id="heading-arco-opposition"
                        tabIndex={-1}
                        className="text-lg font-semibold font-heading text-neutral-700
                          mt-6 mb-2 sm:text-xl focus-visible:outline-none"
                      >
                        {tPrivacy('section.arco.opposition.heading')}
                      </h3>
                      <p className="text-base text-neutral-700 leading-relaxed mb-4">
                        {tPrivacy('section.arco.opposition.body')}
                      </p>
                    </section>

                    {/* ARCO contact — mailto link per AC-15c */}
                    <p className="text-base text-neutral-700 leading-relaxed mb-4 mt-4">
                      {tPrivacy('section.arco.contact.body')}{' '}
                      <a
                        href={`mailto:${ARCO_EMAIL}`}
                        className={[
                          'text-brand-600 hover:text-brand-700 underline underline-offset-2',
                          'motion-safe:transition-colors motion-safe:duration-150',
                          'focus-visible:outline-none focus-visible:ring-2',
                          'focus-visible:ring-brand-600 focus-visible:ring-offset-1 rounded-sm',
                        ].join(' ')}
                      >
                        {ARCO_EMAIL}
                      </a>
                    </p>
                  </section>

                  {/* Section 8 — Cookies */}
                  <section id="section-cookies" aria-labelledby="heading-cookies">
                    <h2
                      id="heading-cookies"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.cookies.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.cookies.body')}
                    </p>
                  </section>

                  {/* Section 9 — Cambios / Changes */}
                  <section id="section-changes" aria-labelledby="heading-changes">
                    <h2
                      id="heading-changes"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.changes.heading')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.changes.body')}
                    </p>
                  </section>

                  {/* Section 10 — Fecha de Vigencia / Effective Date */}
                  <section id="section-effective-date" aria-labelledby="heading-effective-date">
                    <h2
                      id="heading-effective-date"
                      tabIndex={-1}
                      className="text-xl font-semibold font-heading text-neutral-800
                        mt-10 mb-3 sm:text-2xl focus-visible:outline-none"
                    >
                      {tPrivacy('section.effectiveDate.label')}
                    </h2>
                    <p className="text-base text-neutral-700 leading-relaxed mb-4">
                      {tPrivacy('section.effectiveDate.value')}
                    </p>
                  </section>
                </div>
                {/* /prose-content */}
              </div>
              {/* /grid */}
            </article>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="h-auto min-h-12 border-t border-neutral-200 bg-white" role="contentinfo">
          <div className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 max-w-[960px] px-4 py-3">
            <p className="text-xs text-neutral-400 text-center">
              {tLayout('footer.copyright', { year: String(currentYear) })}
            </p>
            <span className="text-neutral-300 text-xs" aria-hidden="true">
              &middot;
            </span>
            <a
              href={locale === 'en' ? '/en/privacy-policy' : '/aviso-de-privacidad'}
              aria-current="page"
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
      </div>
    </>
  );
}
