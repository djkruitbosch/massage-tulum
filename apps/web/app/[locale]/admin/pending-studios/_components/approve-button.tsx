'use client';

/**
 * ApproveButton — client component.
 *
 * Approve action button for a table row. Shows a loading state while the
 * approve action is in flight. Also shows an approval confirmation modal
 * before firing the action.
 *
 * The confirmation modal uses the WAI-ARIA dialog pattern:
 *   - role="dialog" aria-modal="true"
 *   - aria-labelledby referencing the modal heading
 *   - Focus trapped on open; focus returns to trigger on close
 *   - ESC closes the modal
 *
 * This component is intended for the desktop table row. Mobile uses
 * the PendingStudioCard which has its own inline buttons.
 *
 * Ref: docs/design/components/PendingStudiosTable.md §Action Buttons
 * Ticket: CU-869d4za07
 */

import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ApproveButtonProps {
  applicationId: string;
  studioName: string;
  /** Called after modal confirms — parent triggers the server action */
  onConfirm: (applicationId: string) => void;
  /** Whether a server action for this row is in flight */
  isLoading: boolean;
  /** Whether the other action (reject) is in flight for this row */
  otherActionLoading: boolean;
}

export function ApproveButton({
  applicationId,
  studioName,
  onConfirm,
  isLoading,
  otherActionLoading,
}: ApproveButtonProps) {
  const t = useTranslations('admin.pendingStudios');
  const [showModal, setShowModal] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openModal = () => {
    setShowModal(true);
    requestAnimationFrame(() => {
      cancelRef.current?.focus();
    });
  };

  const closeModal = () => {
    setShowModal(false);
    triggerRef.current?.focus();
  };

  const handleConfirm = () => {
    setShowModal(false);
    onConfirm(applicationId);
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const isDisabled = isLoading || otherActionLoading;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        disabled={isDisabled}
        aria-label={t('actions.approveLabel', { studioName })}
        aria-busy={isLoading ? 'true' : undefined}
        className={[
          'h-8 rounded-lg bg-brand-700 px-3',
          'text-xs font-medium text-white',
          'flex items-center justify-center gap-1.5',
          'hover:bg-brand-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          'focus-visible:ring-offset-2',
          'motion-safe:transition-colors motion-safe:duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {isLoading && (
          <Loader2 size={12} className="motion-safe:animate-spin shrink-0" aria-hidden="true" />
        )}
        {isLoading ? t('actions.approvingLabel') : t('actions.approve')}
      </button>

      {/* Approval confirmation modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4"
          onKeyDown={handleModalKeyDown}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-modal-title"
            className="bg-white rounded-2xl shadow-lg p-6 max-w-[480px] w-full"
          >
            <h3 id="approve-modal-title" className="text-xl font-semibold text-neutral-800">
              {t('approveModal.title')}
            </h3>
            <p className="text-sm text-neutral-600 mt-2">
              {t('approveModal.body', { studioName })}
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                ref={cancelRef}
                type="button"
                onClick={closeModal}
                className={[
                  'h-9 rounded-lg border border-neutral-200 bg-white px-4',
                  'text-sm font-medium text-neutral-700',
                  'hover:bg-neutral-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {t('approveModal.cancelButton')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={[
                  'h-9 rounded-lg bg-brand-700 px-4',
                  'text-sm font-medium text-white',
                  'hover:bg-brand-800',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {t('approveModal.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
