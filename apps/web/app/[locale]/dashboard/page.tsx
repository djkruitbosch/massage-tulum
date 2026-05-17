/**
 * Dashboard stub page — Server Component.
 *
 * Auth-protected (middleware redirects unauthenticated requests to /login).
 *
 * Two states:
 *   1. Approved: user has a studio_profiles row → show studio name + stub content.
 *   2. Pending: no studio_profiles row → show PendingApprovalNotice (AC-25).
 *
 * Greeting is static ("Welcome, [name]") per GATE 2 designer Q9 decision —
 * no time-of-day logic in the v1 stub. The design doc §7 lists time-based
 * greeting keys but GATE 2 locked the static greeting to reduce complexity.
 *
 * Ref: docs/design/CU-869d29f1f-studio-owner-auth.md §Screen 4
 * Ticket: CU-869d4za67
 */

import { LayoutGrid, ShoppingBag, UserCircle, Users } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Footer } from '../_components/footer';
import { createClient } from '../../../utils/supabase/server';
import { PendingApprovalNotice } from './_components/pending-approval-notice';
import { UserMenu } from './_components/user-menu';

export default async function DashboardPage() {
  const supabase = await createClient();
  const locale = await getLocale();
  const tLayout = await getTranslations('layout');
  const tDashboard = await getTranslations('auth.dashboard');
  const tLs = await getTranslations('languageSwitcher');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already handles the unauthenticated case, but we guard here
  // as defence-in-depth in case the middleware cookie refresh loses state.
  if (!user) {
    redirect(locale === 'en' ? '/en/login' : '/login');
  }

  // Query studio_profiles for this user (RLS: can only read own row)
  const { data: studioProfile } = await supabase
    .from('studio_profiles')
    .select('studio_id')
    .eq('id', user.id)
    .single();

  // AC-25: no studio_profiles row → show pending approval state
  if (!studioProfile) {
    return (
      <>
        <a href="#main-content" className="skip-link">
          {tLayout('skipLink')}
        </a>
        <div className="flex min-h-screen flex-col">
          <DashboardHeader email={user.email ?? ''} locale={locale} tLayout={tLayout} tLs={tLs} />
          <main id="main-content" className="flex-1 bg-neutral-50" role="main">
            <PendingApprovalNotice />
          </main>
          <Footer locale={locale} />
        </div>
      </>
    );
  }

  // Approved state: fetch studio name
  const { data: studio } = await supabase
    .from('studios')
    .select('name')
    .eq('id', studioProfile.studio_id)
    .single();

  const studioName = studio?.name ?? '';

  return (
    <>
      <a href="#main-content" className="skip-link">
        {tLayout('skipLink')}
      </a>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader email={user.email ?? ''} locale={locale} tLayout={tLayout} tLs={tLs} />
        <main id="main-content" className="flex-1 bg-neutral-50" role="main">
          <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="font-heading text-3xl font-bold text-neutral-800 sm:text-2xl md:text-3xl">
              {tDashboard('greeting', { name: studioName })}
            </h1>

            {/* Temporary nav links — full nav design deferred to auth feature */}
            <nav className="mt-6 flex flex-wrap gap-3" aria-label={tDashboard('stub.title')}>
              <a
                href={locale === 'en' ? '/en/studio/profile' : '/studio/profile'}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border border-neutral-200',
                  'bg-white px-4 py-2.5 text-sm font-medium text-neutral-700',
                  'hover:bg-neutral-50 hover:border-neutral-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <UserCircle size={16} className="text-neutral-500" aria-hidden="true" />
                {tDashboard('nav.studioProfile')}
              </a>
              <a
                href={locale === 'en' ? '/en/studio/therapists' : '/studio/therapists'}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border border-neutral-200',
                  'bg-white px-4 py-2.5 text-sm font-medium text-neutral-700',
                  'hover:bg-neutral-50 hover:border-neutral-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <Users size={16} className="text-neutral-500" aria-hidden="true" />
                {tDashboard('nav.therapists')}
              </a>
              <a
                href={locale === 'en' ? '/en/studio/services' : '/studio/services'}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border border-neutral-200',
                  'bg-white px-4 py-2.5 text-sm font-medium text-neutral-700',
                  'hover:bg-neutral-50 hover:border-neutral-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <ShoppingBag size={16} className="text-neutral-500" aria-hidden="true" />
                {tDashboard('nav.services')}
              </a>
            </nav>

            {/* Stub placeholder card */}
            <div className="bg-neutral-100 border border-neutral-200 rounded-2xl p-8 mt-6">
              <LayoutGrid size={24} className="text-neutral-400" aria-hidden="true" />
              <p className="text-base text-neutral-500 mt-2">{tDashboard('stub.title')}</p>
              <p className="text-sm text-neutral-400 mt-1">{tDashboard('stub.body')}</p>
            </div>
          </div>
        </main>
        <Footer locale={locale} />
      </div>
    </>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

interface HeaderProps {
  email: string;
  locale: string;
  tLayout: ReturnType<typeof useTranslations<'layout'>>;
  tLs: ReturnType<typeof useTranslations<'languageSwitcher'>>;
}

function DashboardHeader({ email, locale, tLayout, tLs }: HeaderProps) {
  return (
    <header className="h-16 border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto flex h-full max-w-content items-center justify-between px-4 sm:px-6 lg:px-8">
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
              href="/dashboard"
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
              href="/en/dashboard"
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
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
