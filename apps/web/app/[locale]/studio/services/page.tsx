/**
 * Service Catalog page — Server Component.
 *
 * Auth-protected: middleware redirects unauthenticated requests to /login.
 * Defence-in-depth: checks session here too.
 *
 * States:
 *   - Loaded: renders <ServiceList> with service data.
 *   - Error (unauthenticated): redirects to /login.
 *   - Error (not_found): no studio profile — renders error.
 *   - Error (server_error): renders inline error state.
 *
 * URL: /studio/services (ES), /en/studio/services (EN)
 * URL param: ?status=active|inactive|all (default: active)
 *
 * Ref: docs/design/service-catalog.md §1
 * Ref: docs/architecture/CU-869d29f21-service-catalog.md §5
 * Ticket: CU-869d29f21
 */

import { AlertCircle } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';
import { listServices } from '../../../../actions/services';
import { createClient } from '../../../../utils/supabase/server';
import { Footer } from '../../_components/footer';
import { ServiceList } from './_components/service-list';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterParam = 'active' | 'inactive' | 'all';

interface ServicesPageProps {
  searchParams: Promise<{ status?: string }>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const locale = await getLocale();
  const t = await getTranslations('serviceCatalog');
  const tLayout = await getTranslations('layout');

  // Defence-in-depth auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    const nextPath = locale === 'en' ? '/en/studio/services' : '/studio/services';
    redirect(`${loginPath}?next=${nextPath}`);
  }

  // Parse ?status param (default: active)
  const { status } = await searchParams;
  const filter: FilterParam = status === 'inactive' || status === 'all' ? status : 'active';

  // Fetch services from NestJS BE
  const result = await listServices(filter);

  if (!result.success && result.error === 'unauthenticated') {
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    const nextPath = locale === 'en' ? '/en/studio/services' : '/studio/services';
    redirect(`${loginPath}?next=${nextPath}`);
  }

  const dashboardHref = locale === 'en' ? '/en/dashboard' : '/dashboard';

  return (
    <>
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>
      <div className="flex min-h-screen flex-col bg-neutral-50">
        {/* Header */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm" role="banner">
          <div className="mx-auto flex h-full max-w-content items-center justify-between px-4 sm:px-6 lg:px-8">
            <a
              href={dashboardHref}
              className={[
                'font-heading text-xl font-bold text-brand-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2 rounded',
              ].join(' ')}
              aria-label={tLayout('header.logoAlt')}
            >
              {tLayout('header.logoAlt')}
            </a>
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" className="flex-1" role="main">
          <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">
            {!result.success ? (
              /* Server error state */
              <div
                className="flex gap-3 rounded-lg border-l-4 border-danger-500 bg-danger-50 p-6"
                role="alert"
              >
                <AlertCircle
                  size={20}
                  className="text-danger-500 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-neutral-700">{t('loadError.title')}</p>
                  <p className="mt-1 text-sm text-neutral-500">{t('loadError.body')}</p>
                  <a
                    href={locale === 'en' ? '/en/studio/services' : '/studio/services'}
                    className={[
                      'mt-3 inline-flex items-center rounded-lg border border-neutral-200',
                      'bg-white px-4 py-2 text-sm font-medium text-neutral-700',
                      'hover:bg-neutral-50',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                      'focus-visible:ring-offset-2',
                    ].join(' ')}
                  >
                    {t('loadError.retry')}
                  </a>
                </div>
              </div>
            ) : (
              <Suspense>
                <ServiceList initialServices={result.data} initialFilter={filter} locale={locale} />
              </Suspense>
            )}
          </div>
        </main>

        <Footer locale={locale} />
      </div>
    </>
  );
}
