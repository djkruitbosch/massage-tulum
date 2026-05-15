'use client';

/**
 * DeactivateConfirmModal — confirmation dialog for deactivating a service.
 *
 * On open: fetches future bookings count via getFutureBookingsCount().
 * Shows conditional warning block only if futureBookingsCount > 0.
 * In v1 count is always 0; UI must still render correctly if count were positive.
 *
 * Focus: initial focus on Cancel (destructive confirmation best practice).
 * Escape: closes without action.
 *
 * Ref: docs/design/service-catalog.md §6
 * Ticket: CU-869d29f21
 */

import type { ServiceResponse } from '@massage-tulum/shared';
import { AlertTriangle, EyeOff, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { deactivateService, getFutureBookingsCount } from '../../../../../actions/services';

interface DeactivateConfirmModalProps {
  service: ServiceResponse;
  onSuccess: (service: ServiceResponse) => void;
  onClose: () => void;
}

export function DeactivateConfirmModal({
  service,
  onSuccess,
  onClose,
}: DeactivateConfirmModalProps) {
  const t = useTranslations('serviceCatalog');
  const tCommon = useTranslations('common');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [futureBookingsCount, setFutureBookingsCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // Fetch future bookings count on open
  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      const result = await getFutureBookingsCount(service.id);
      if (!cancelled) {
        setCountLoading(false);
        if (result.success) {
          setFutureBookingsCount(result.data.futureBookingsCount);
        } else {
          // Non-critical — proceed with 0 count if fetch fails
          setFutureBookingsCount(0);
        }
      }
    }

    fetchCount();
    return () => {
      cancelled = true;
    };
  }, [service.id]);

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
      const result = await deactivateService(service.id);
      if (result.success) {
        onSuccess(result.data);
      } else {
        setError(tCommon('error.title'));
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
          <EyeOff size={24} className="text-danger-500" aria-hidden="true" />
          <h3 id={titleId} className="text-base font-semibold text-neutral-800">
            {t('deactivate.title', { name: service.name })}
          </h3>
        </div>

        {/* Body */}
        <p className="mt-3 text-sm text-neutral-600">{t('deactivate.body')}</p>

        {/* Loading state for future bookings count */}
        {countLoading && (
          <div className="mt-3 h-4 w-48 rounded bg-neutral-100 animate-pulse" aria-hidden="true" />
        )}

        {/* Warning block — conditional on futureBookingsCount > 0 */}
        {!countLoading && futureBookingsCount != null && futureBookingsCount > 0 && (
          <div
            className={[
              'mt-3 flex gap-2',
              'bg-warning-50 border-l-4 border-warning-500 p-3 rounded-r',
            ].join(' ')}
            role="status"
          >
            <AlertTriangle
              size={16}
              className="text-warning-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-warning-700">
              {t('deactivate.hasBookings', { count: String(futureBookingsCount) })}
            </p>
          </div>
        )}

        {/* Inline error */}
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
            disabled={isPending || countLoading}
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
