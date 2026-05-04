/**
 * Admin: Pending Studios page — Server Component.
 *
 * AC-22: Returns 404 (via notFound()) for:
 *   - Unauthenticated users (middleware redirects them to /login, but we
 *     guard here as defence-in-depth).
 *   - Authenticated users whose email is NOT in the ADMIN_EMAILS env var.
 *   This avoids 403 route enumeration (don't reveal the route exists).
 *
 * Admin identity check: compares the authenticated user's email against the
 * ADMIN_EMAILS env var (comma-separated). This check is server-side only;
 * ADMIN_EMAILS must NOT use the NEXT_PUBLIC_ prefix (would expose to client).
 *
 * Data fetching: calls the NestJS GET /api/admin/pending-studios endpoint
 * using the admin's JWT. Falls back to empty list if the API is unavailable.
 *
 * Ref: docs/adr/0008-studio-onboarding-self-signup.md §3
 * Ref: docs/architecture/CU-869d29f1f-studio-owner-auth.md §4
 * Ticket: CU-869d4za07
 */

import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '../../../../utils/supabase/server';
import { fetchPendingStudios } from '../../../../actions/admin';
import { PendingStudiosList } from './_components/pending-studios-list';
import { UserMenu } from '../../dashboard/_components/user-menu';

export default async function PendingStudiosPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const tLayout = await getTranslations('layout');
  const tAdmin = await getTranslations('admin.pendingStudios');
  const tLs = await getTranslations('languageSwitcher');

  // ── Auth check ─────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware should have caught this, but guard defensively.
    redirect(locale === 'en' ? '/en/login' : '/login');
  }

  // ── Admin check (AC-22) ────────────────────────────────────────────────────
  // ADMIN_EMAILS is a server-only env var (no NEXT_PUBLIC_ prefix).
  // Comparison is case-insensitive.
  const adminEmailsRaw = process.env.ADMIN_EMAILS ?? '';
  const adminEmails = adminEmailsRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = user.email?.toLowerCase() ?? '';
  const isAdmin = adminEmails.length > 0 && adminEmails.includes(userEmail);

  if (!isAdmin) {
    // Return 404 — do not reveal the route exists (AC-22).
    notFound();
  }

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const result = await fetchPendingStudios();
  const applications = result.success ? result.data : [];
  const total = result.success ? result.total : 0;

  const currentYear = new Date().getFullYear();

  return (
    <>
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>

      <div className="flex min-h-screen flex-col">
        {/* HEADER */}
        <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-wide items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <span
              className="font-heading text-xl font-bold text-brand-700"
              aria-label={tLayout('header.logoAlt')}
            >
              {tLayout('header.logoAlt')}
            </span>

            {/* Right slot: Language switcher + UserMenu */}
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div role="group" aria-label={tLs('label')} className="flex items-center gap-1">
                <a
                  href="/admin/pending-studios"
                  aria-label={
                    locale === 'es' ? tLs('current', { locale: tLs('esTitle') }) : tLs('esTitle')
                  }
                  aria-current={locale === 'es' ? 'true' : undefined}
                  className={[
                    'min-h-[44px] min-w-[44px] flex items-center justify-center',
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    'motion-safe:transition-colors motion-safe:duration-150',
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
                  href="/en/admin/pending-studios"
                  aria-label={
                    locale === 'en' ? tLs('current', { locale: tLs('enTitle') }) : tLs('enTitle')
                  }
                  aria-current={locale === 'en' ? 'true' : undefined}
                  className={[
                    'min-h-[44px] min-w-[44px] flex items-center justify-center',
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    'motion-safe:transition-colors motion-safe:duration-150',
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

              {/* UserMenu */}
              <UserMenu email={user.email ?? ''} />
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main id="main-content" className="flex-1 bg-neutral-50" role="main">
          <div className="max-w-wide mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page heading */}
            <div className="flex items-baseline gap-3 mb-6">
              <h1 className="font-heading text-3xl font-bold text-neutral-800">
                {tAdmin('title')}
              </h1>
              {total > 0 && (
                <span className="text-sm text-neutral-500">
                  {tAdmin('count', { count: total })}
                </span>
              )}
            </div>

            {/* Applications list */}
            <PendingStudiosList initialApplications={applications} locale={locale} />
          </div>
        </main>

        {/* FOOTER */}
        <footer className="h-12 border-t border-neutral-200 bg-white" role="contentinfo">
          <div className="mx-auto flex h-full max-w-wide items-center justify-center px-4">
            <p className="text-xs text-neutral-400 text-center">
              {tLayout('footer.copyright', { year: String(currentYear) })}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
