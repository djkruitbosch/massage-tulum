/**
 * StatusPill — service status badge.
 *
 * Renders "Activo"/"Active" or "Desactivado"/"Deactivated" based on the status prop.
 * Server-renderable; no client-side state.
 *
 * Ref: docs/design/service-catalog.md §4
 * Ticket: CU-869d29f21
 */

import { useTranslations } from 'next-intl';

interface StatusPillProps {
  status: 'active' | 'inactive';
}

export function StatusPill({ status }: StatusPillProps) {
  const t = useTranslations('serviceCatalog');
  const isActive = status === 'active';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        isActive ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500',
      ].join(' ')}
    >
      {isActive ? t('status.active') : t('status.inactive')}
    </span>
  );
}
