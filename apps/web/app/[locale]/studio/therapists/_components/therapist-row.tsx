'use client';

/**
 * TherapistRow — a single therapist in the list.
 *
 * Desktop: horizontal flex row. Avatar + name/role on left. Actions on right.
 * Mobile: flex-col. Line 1: avatar + name/role. Line 2: actions aligned right.
 *
 * Active therapist: Edit + Deactivate buttons.
 * Inactive therapist: Reactivate button only (no Edit in v1 for deactivated).
 *
 * StatusPill: shown only on "All" and "Deactivated" filters.
 *
 * Ref: docs/design/therapist-roster.md §4
 * Ticket: CU-869d8k3yv
 */

import type { Therapist } from '@massage-tulum/shared';
import { Pencil, UserCheck, UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TherapistAvatar } from './therapist-avatar';

interface TherapistRowProps {
  therapist: Therapist;
  showStatus: boolean;
  onEdit: (therapist: Therapist) => void;
  onDeactivate: (therapist: Therapist) => void;
  onReactivate: (therapist: Therapist) => void;
}

export function TherapistRow({
  therapist,
  showStatus,
  onEdit,
  onDeactivate,
  onReactivate,
}: TherapistRowProps) {
  const t = useTranslations('therapistRoster');

  const isActive = therapist.status === 'active';

  return (
    <li className="py-3 border-b border-neutral-100 last:border-b-0">
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-between gap-3">
        {/* Left: avatar + info */}
        <div className="flex items-center gap-3 min-w-0">
          <TherapistAvatar name={therapist.name} photoUrl={therapist.photoUrl} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-neutral-800 truncate">
                {therapist.name}
              </span>
              {showStatus && <StatusPill active={isActive} t={t} />}
            </div>
            <span className="text-sm text-neutral-500 block truncate">{therapist.role}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(therapist)}
                aria-label={t('action.edit', { name: therapist.name })}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                  'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeactivate(therapist)}
                aria-label={t('action.deactivate', { name: therapist.name })}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                  'text-danger-500 hover:text-danger-700 hover:bg-danger-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <UserMinus size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(therapist)}
              aria-label={t('action.reactivate', { name: therapist.name })}
              className={[
                'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                'text-success-500 hover:text-success-700 hover:bg-success-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500',
                'focus-visible:ring-offset-2',
                'motion-safe:transition-colors motion-safe:duration-150',
              ].join(' ')}
            >
              <UserCheck size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col gap-2 sm:hidden">
        {/* Line 1: avatar + info */}
        <div className="flex items-center gap-3 min-w-0">
          <TherapistAvatar name={therapist.name} photoUrl={therapist.photoUrl} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-medium text-neutral-800 truncate">
                {therapist.name}
              </span>
              {showStatus && <StatusPill active={isActive} t={t} />}
            </div>
            <span className="text-sm text-neutral-500 block truncate">{therapist.role}</span>
          </div>
        </div>

        {/* Line 2: actions aligned right */}
        <div className="flex items-center justify-end gap-1">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(therapist)}
                aria-label={t('action.edit', { name: therapist.name })}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                  'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeactivate(therapist)}
                aria-label={t('action.deactivate', { name: therapist.name })}
                className={[
                  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                  'text-danger-500 hover:text-danger-700 hover:bg-danger-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
                  'motion-safe:transition-colors motion-safe:duration-150',
                ].join(' ')}
              >
                <UserMinus size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(therapist)}
              aria-label={t('action.reactivate', { name: therapist.name })}
              className={[
                'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
                'text-success-500 hover:text-success-700 hover:bg-success-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500',
                'motion-safe:transition-colors motion-safe:duration-150',
              ].join(' ')}
            >
              <UserCheck size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────

interface StatusPillProps {
  active: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

function StatusPill({ active, t }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        active ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500',
      ].join(' ')}
    >
      {active ? t('status.active') : t('status.deactivated')}
    </span>
  );
}
