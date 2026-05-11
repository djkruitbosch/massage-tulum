/**
 * Studio Profile page — Server Component.
 *
 * Auth-protected: middleware redirects unauthenticated requests to /login.
 * Defence-in-depth: if the server action returns 'unauthenticated', redirect
 * here as well to avoid a blank page.
 *
 * States:
 *   - Loaded (has data): renders ProfileFormWrapper pre-filled
 *   - Loaded (404 — no profile yet): renders ProfileFormWrapper in empty state
 *   - Error (server_error): renders inline error state with retry link
 *   - Unauthenticated: redirects to /login
 *
 * URL: /studio/profile (es default), /en/studio/profile (en)
 * No path translation needed — same segment in both locales.
 *
 * Ref: docs/architecture/CU-869d29f1h-studio-profile.md §4a
 * Ticket: CU-869d8cp2d
 */

import { AlertCircle } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import React from 'react';
import { getMyStudioProfile } from '../../../../actions/studio-profile';
import { createClient } from '../../../../utils/supabase/server';
import { ProfileFormWrapper } from './_components/profile-form-wrapper';

export default async function StudioProfilePage() {
  const locale = await getLocale();
  const t = await getTranslations('studioProfile');
  const tLayout = await getTranslations('layout');

  // Defence-in-depth auth check (middleware handles the primary redirect)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    const nextPath = locale === 'en' ? '/en/studio/profile' : '/studio/profile';
    redirect(`${loginPath}?next=${nextPath}`);
  }

  // Fetch profile from NestJS BE via server action (forwards Bearer JWT)
  const result = await getMyStudioProfile();

  // Redirect if unauthenticated (shouldn't happen post-middleware, but defensive)
  if (!result.success && result.error === 'unauthenticated') {
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    const nextPath = locale === 'en' ? '/en/studio/profile' : '/studio/profile';
    redirect(`${loginPath}?next=${nextPath}`);
  }

  // Server error — render error state (no form)
  if (!result.success && result.error === 'server_error') {
    const retryHref = locale === 'en' ? '/en/studio/profile' : '/studio/profile';
    return (
      <ProfileShell tLayout={tLayout} locale={locale}>
        <div
          className="flex gap-3 rounded-lg border-l-4 border-danger-500 bg-danger-50 p-6"
          role="alert"
        >
          <AlertCircle size={20} className="text-danger-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-700">{t('loadError.title')}</p>
            <p className="mt-1 text-sm text-neutral-500">{t('loadError.body')}</p>
            <a
              href={retryHref}
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
      </ProfileShell>
    );
  }

  // 404 (no studio profile row yet) or success — either way render the form.
  // When 404, initialData = null → form shows empty-state banner.
  const profileData = result.success ? result.data : null;

  return (
    <ProfileShell tLayout={tLayout} locale={locale}>
      <ProfileFormWrapper initialData={profileData} locale={locale} />
    </ProfileShell>
  );
}

// ── Shell (page layout wrapper) ───────────────────────────────────────────────

interface ProfileShellProps {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tLayout: any;
  locale: string;
}

function ProfileShell({ children, tLayout, locale }: ProfileShellProps) {
  const currentYear = new Date().getFullYear();
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
          <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>

        {/* Footer */}
        <footer className="h-12 border-t border-neutral-200 bg-white" role="contentinfo">
          <div className="mx-auto flex h-full max-w-content items-center justify-center px-4">
            <p className="text-xs text-neutral-400 text-center">
              {tLayout('footer.copyright', { year: String(currentYear) })}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
