'use client';

/**
 * PendingStudioCard — client component (mobile card variant).
 *
 * Renders a single pending studio application as a stacked card for
 * mobile viewports (<768px). Includes description expand/collapse toggle.
 *
 * The approve/reject callbacks are passed from the page component which
 * owns the modal state.
 *
 * Ref: docs/design/components/PendingStudiosTable.md §Mobile Card List
 * Ticket: CU-869d4za07
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PendingStudioCardProps {
  id: string;
  submittedAt: string;
  email: string;
  studioName: string;
  contactPhone: string | null;
  description: string;
  locale: string;
  loadingAction: 'approve' | 'reject' | null;
  onApprove: (id: string, studioName: string) => void;
  onReject: (id: string, studioName: string) => void;
}

export function PendingStudioCard({
  id,
  submittedAt,
  email,
  studioName,
  contactPhone,
  description,
  locale,
  loadingAction,
  onApprove,
  onReject,
}: PendingStudioCardProps) {
  const t = useTranslations('admin.pendingStudios');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const formattedDate = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(submittedAt));

  const isApprovingThisRow = loadingAction === 'approve';
  const isAnyActionInFlight = loadingAction !== null;

  const descriptionId = `card-desc-${id}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
      {/* Header row: studio name + date */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-neutral-800">{studioName}</span>
        <span className="text-xs text-neutral-400 shrink-0 mt-0.5" title={submittedAt}>
          {formattedDate}
        </span>
      </div>

      {/* Email */}
      <p className="text-sm text-neutral-500 mt-1 truncate">{email}</p>

      {/* Phone (if present) */}
      {contactPhone && <p className="text-sm text-neutral-500 mt-1">{contactPhone}</p>}

      {/* Description with expand/collapse */}
      {description && (
        <div className="mt-2">
          <p
            id={descriptionId}
            className={['text-sm text-neutral-600', descriptionExpanded ? '' : 'line-clamp-2']
              .filter(Boolean)
              .join(' ')}
          >
            {description}
          </p>
          <button
            type="button"
            aria-expanded={descriptionExpanded}
            aria-controls={descriptionId}
            onClick={() => setDescriptionExpanded((prev) => !prev)}
            className={[
              'text-xs text-brand-600 mt-1',
              'hover:underline underline-offset-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'focus-visible:ring-offset-2 rounded',
            ].join(' ')}
          >
            {descriptionExpanded ? t('description.showLess') : t('description.showMore')}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onApprove(id, studioName)}
          disabled={isAnyActionInFlight}
          aria-label={t('actions.approveLabel', { studioName })}
          aria-busy={isApprovingThisRow ? 'true' : undefined}
          className={[
            'w-full h-10 rounded-lg bg-brand-700 px-4',
            'text-sm font-medium text-white',
            'flex items-center justify-center gap-2',
            'hover:bg-brand-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {isApprovingThisRow ? t('actions.approvingLabel') : t('actions.approve')}
        </button>

        <button
          type="button"
          onClick={() => onReject(id, studioName)}
          disabled={isAnyActionInFlight}
          aria-label={t('actions.rejectLabel', { studioName })}
          className={[
            'w-full h-10 rounded-lg border border-neutral-200 bg-white px-4',
            'text-sm font-medium text-neutral-700',
            'flex items-center justify-center',
            'hover:bg-neutral-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {t('actions.reject')}
        </button>
      </div>
    </div>
  );
}
