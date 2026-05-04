'use client';

/**
 * RejectModal — client component.
 *
 * Rejection modal dialog for a pending studio application.
 * Contains an optional reason textarea and confirm/cancel buttons.
 *
 * WAI-ARIA dialog pattern:
 *   - role="dialog" aria-modal="true" aria-labelledby
 *   - Focus set to textarea on open; returns to trigger on close
 *   - ESC closes the modal
 *   - Backdrop click closes the modal
 *
 * Ref: docs/design/CU-869d29f1f-studio-owner-auth.md §Rejection Modal
 * Ref: docs/design/components/PendingStudiosTable.md §Action Buttons
 * Ticket: CU-869d4za07
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface RejectModalProps {
  /** Called with the optional reason when admin confirms rejection */
  onConfirm: (reason: string | null) => void;
  /** Called when admin cancels */
  onCancel: () => void;
}

export function RejectModal({ onConfirm, onCancel }: RejectModalProps) {
  const t = useTranslations('admin.pendingStudios');
  const [reason, setReason] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  const handleMount = (el: HTMLTextAreaElement | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ref assignment
    (textareaRef as any).current = el;
    if (el) {
      el.focus();
    }
  };

  const handleConfirm = () => {
    onConfirm(reason.trim() || null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[90] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
        className="bg-white rounded-2xl shadow-lg p-6 max-w-[480px] w-full"
      >
        <h3 id="reject-modal-title" className="text-xl font-semibold text-neutral-800">
          {t('rejectModal.title')}
        </h3>

        {/* Reason textarea */}
        <div className="mt-4">
          <label
            htmlFor="reject-reason"
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            {t('rejectModal.reasonLabel')}
          </label>
          <textarea
            ref={handleMount}
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('rejectModal.reasonPlaceholder')}
            className={[
              'w-full rounded-lg border border-neutral-200 bg-white px-4 py-3',
              'text-sm text-neutral-700 placeholder:text-neutral-400',
              'resize-none',
              'hover:border-neutral-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
              'focus-visible:ring-brand-600 focus-visible:border-brand-600',
              'motion-safe:transition-colors motion-safe:duration-150',
            ].join(' ')}
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onCancel}
            className={[
              'h-9 rounded-lg border border-neutral-200 bg-white px-4',
              'text-sm font-medium text-neutral-700',
              'hover:bg-neutral-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'focus-visible:ring-offset-2',
            ].join(' ')}
          >
            {t('rejectModal.cancelButton')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={[
              'h-9 rounded-lg bg-danger-500 px-4',
              'text-sm font-medium text-white',
              'hover:bg-danger-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
              'focus-visible:ring-offset-2',
            ].join(' ')}
          >
            {t('rejectModal.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
