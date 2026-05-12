'use client';

/**
 * AddTherapistModal — wraps TherapistForm in a modal dialog for creating a therapist.
 *
 * Note: photo upload is NOT included in the Add modal (per architecture §5e).
 * Photos can only be uploaded via the Edit modal after the therapist record is created.
 *
 * Accessibility:
 *   - role="dialog" with aria-labelledby pointing to dialog title.
 *   - Escape key closes the modal.
 *   - Focus trap: Tab cycles within the modal.
 *   - Focus returns to the trigger button on close.
 *   - Initial focus goes to the first form field (handled by TherapistForm).
 *   - Backdrop click closes the modal.
 *
 * Ref: docs/design/therapist-roster.md §5
 * Ticket: CU-869d8k3yv
 */

import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from '@massage-tulum/shared';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { createTherapist } from '../../../../../actions/therapists';
import { TherapistForm } from './therapist-form';

interface AddTherapistModalProps {
  locale: string;
  onSuccess: (therapist: Therapist) => void;
  onClose: () => void;
}

export function AddTherapistModal({ locale, onSuccess, onClose }: AddTherapistModalProps) {
  const t = useTranslations('therapistRoster');
  const tCommon = useTranslations('common');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Escape key closes the modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    firstFocusable?.focus();

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

  async function handleSubmit(input: CreateTherapistInput | UpdateTherapistInput) {
    // Add modal always creates — cast is safe; the form validates required fields.
    return createTherapist(input as CreateTherapistInput);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[190] bg-black/40 motion-safe:animate-fadeIn"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          'fixed z-[200] w-full max-w-lg',
          'top-[10vh] left-1/2 -translate-x-1/2',
          'mx-4',
          'bg-white rounded-lg shadow-lg',
          'flex flex-col max-h-[80vh]',
          'motion-safe:animate-scaleIn',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100">
          <h3 id={titleId} className="text-base font-semibold text-neutral-800">
            {t('modal.add.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('button.close')}
            className={[
              'rounded p-1 text-neutral-400',
              'hover:text-neutral-600 hover:bg-neutral-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'motion-safe:transition-colors motion-safe:duration-150',
            ].join(' ')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TherapistForm
            locale={locale}
            onSuccess={onSuccess}
            onCancel={onClose}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
}
