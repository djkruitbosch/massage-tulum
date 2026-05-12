'use client';

/**
 * DeactivateTherapistDialog — confirmation dialog for deactivating a therapist.
 *
 * Always shown (no "don't show again" checkbox). Destructive mode.
 * The warning about upcoming bookings is always rendered (no API-gate).
 *
 * Focus: initial focus on Cancel button (destructive confirmation best practice).
 * Escape: closes without action.
 *
 * Ref: docs/design/therapist-roster.md §6
 * Ticket: CU-869d8k3yv
 */

import type { Therapist } from '@massage-tulum/shared';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { setTherapistStatus } from '../../../../../actions/therapists';

interface DeactivateTherapistDialogProps {
  therapist: Therapist;
  onSuccess: (therapist: Therapist) => void;
  onClose: () => void;
}

export function DeactivateTherapistDialog({
  therapist,
  onSuccess,
  onClose,
}: DeactivateTherapistDialogProps) {
  const t = useTranslations('therapistRoster');
  const tCommon = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap + initial focus on Cancel
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Initial focus on Cancel (destructive pattern)
    cancelRef.current?.focus();

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, []);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setTherapistStatus(therapist.id, 'inactive');
      if (result.success) {
        onSuccess(result.data);
      } else {
        setError(t('deactivate.error'));
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[190] bg-black/40" aria-hidden="true" onClick={onClose} />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          'fixed z-[200] w-full max-w-md',
          'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'mx-4',
          'bg-white rounded-lg shadow-lg p-6',
        ].join(' ')}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('button.close')}
          className={[
            'absolute right-4 top-4 rounded p-1 text-neutral-400',
            'hover:text-neutral-600 hover:bg-neutral-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          ].join(' ')}
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Icon + title */}
        <div className="flex flex-col items-start gap-3">
          <AlertTriangle size={24} className="text-warning-500" aria-hidden="true" />
          <h3 id={titleId} className="text-base font-semibold text-neutral-800">
            {t('deactivate.title', { name: therapist.name })}
          </h3>
        </div>

        {/* Body */}
        <p className="mt-3 text-sm text-neutral-600">{t('deactivate.body')}</p>

        {/* Warning box — always rendered */}
        <p
          className={[
            'mt-3 text-sm font-medium text-warning-700',
            'bg-warning-50 rounded-lg p-3 border-l-4 border-warning-500',
          ].join(' ')}
        >
          {t('deactivate.warning')}
        </p>

        {/* Inline error (server-action failure) */}
        {error && (
          <p
            role="alert"
            className={[
              'mt-3 text-sm font-medium text-danger-700',
              'bg-danger-50 rounded-lg p-3 border-l-4 border-danger-500',
            ].join(' ')}
          >
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={[
              'h-10 rounded-lg border border-neutral-200 bg-white px-4',
              'text-sm font-medium text-neutral-700',
              'hover:bg-neutral-50 hover:border-neutral-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50',
              'w-full sm:w-auto',
            ].join(' ')}
          >
            {tCommon('button.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending}
            className={[
              'h-10 rounded-lg bg-danger-600 px-6',
              'text-sm font-medium text-white',
              'hover:bg-danger-700',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
              'focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-80',
              'w-full sm:w-auto',
            ].join(' ')}
          >
            {isPending ? tCommon('button.loading') : t('action.deactivateConfirm')}
          </button>
        </div>
      </div>
    </>
  );
}
