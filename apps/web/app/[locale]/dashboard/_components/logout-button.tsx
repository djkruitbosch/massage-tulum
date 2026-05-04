'use client';

/**
 * LogoutButton — client component.
 *
 * Calls the logout server action when clicked.
 * Shows a loading spinner during the sign-out operation.
 *
 * Used in:
 *   - PendingApprovalNotice (secondary variant, full width)
 *   - UserMenu (inline menu item, no variant)
 *
 * Ticket: CU-869d4za67
 */

import { Loader2, LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { logout } from '../../../../actions/auth';

interface LogoutButtonProps {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function LogoutButton({
  variant = 'secondary',
  fullWidth = false,
  showIcon = false,
  size = 'md',
}: LogoutButtonProps) {
  const t = useTranslations('auth.logout');
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  const baseClasses = [
    'flex items-center justify-center gap-2 rounded-lg font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
    'focus-visible:ring-offset-2',
    'motion-safe:transition-colors motion-safe:duration-150',
    'disabled:cursor-not-allowed disabled:opacity-70',
    fullWidth ? 'w-full' : '',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs',
  ]
    .filter(Boolean)
    .join(' ');

  const variantClasses =
    variant === 'primary'
      ? 'bg-brand-700 text-white hover:bg-brand-800'
      : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-brand-50 hover:border-brand-400';

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-busy={isPending ? 'true' : undefined}
      aria-disabled={isPending ? 'true' : undefined}
      className={`${baseClasses} ${variantClasses}`}
    >
      {isPending ? (
        <Loader2 size={16} className="motion-safe:animate-spin shrink-0" aria-hidden="true" />
      ) : showIcon ? (
        <LogOut size={16} className="shrink-0" aria-hidden="true" />
      ) : null}
      {t('button')}
    </button>
  );
}
