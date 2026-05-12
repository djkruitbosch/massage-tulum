'use client';

/**
 * EditTherapistModal — wraps TherapistForm with photo upload for editing a therapist.
 *
 * Includes the TherapistPhotoUpload widget at the top of the form body
 * (per architecture §5e: photo upload is Edit-only).
 *
 * Accessibility:
 *   - Same modal pattern as AddTherapistModal.
 *   - Initial focus on first form field (Name).
 *
 * Ref: docs/design/therapist-roster.md §5
 * Ticket: CU-869d8k3yv
 */

import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from '@massage-tulum/shared';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { updateTherapist } from '../../../../../actions/therapists';
import { TherapistForm } from './therapist-form';

interface EditTherapistModalProps {
  therapist: Therapist;
  locale: string;
  onSuccess: (therapist: Therapist) => void;
  onClose: () => void;
}

export function EditTherapistModal({
  therapist,
  locale,
  onSuccess,
  onClose,
}: EditTherapistModalProps) {
  const t = useTranslations('therapistRoster');
  const tCommon = useTranslations('common');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
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
    return updateTherapist(therapist.id, input as UpdateTherapistInput);
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
            {t('modal.edit.title')}
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

        {/* Scrollable body — includes photo upload + form */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <TherapistForm
            initialData={therapist}
            locale={locale}
            onSuccess={onSuccess}
            onCancel={onClose}
            onSubmit={handleSubmit}
            therapistId={therapist.id}
            initialPhotoUrl={therapist.photoUrl}
          />
        </div>
      </div>
    </>
  );
}
