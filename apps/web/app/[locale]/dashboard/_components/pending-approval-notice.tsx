/**
 * PendingApprovalNotice — Server Component.
 *
 * Shown on /dashboard when an authenticated user has no studio_profiles row.
 * The user has an auth.users account but hasn't been approved by the admin yet.
 *
 * Does NOT redirect to /login — that would create a confusing redirect loop
 * for users who are authenticated but pending (spec AC-25).
 *
 * Ref: docs/design/components/PendingApprovalState.md
 * Ticket: CU-869d4za67
 */

import { Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LogoutButton } from './logout-button';

export async function PendingApprovalNotice() {
  const t = await getTranslations('auth');

  return (
    <div className="max-w-narrow mx-auto px-4 py-8 sm:py-16">
      <div
        className="bg-warning-50 border border-warning-500 rounded-2xl shadow-sm p-5 sm:p-8"
        role="status"
        aria-label={t('dashboard.pendingApproval.title')}
      >
        <Clock size={32} className="text-warning-500 block mx-auto" aria-hidden="true" />
        <h1 className="font-heading text-xl font-semibold text-warning-700 text-center mt-4">
          {t('dashboard.pendingApproval.title')}
        </h1>
        <p className="text-sm text-warning-700 text-center mt-3 max-w-xs mx-auto">
          {t('dashboard.pendingApproval.body')}
        </p>
        <div className="mt-6">
          <LogoutButton variant="secondary" fullWidth />
        </div>
      </div>
    </div>
  );
}
