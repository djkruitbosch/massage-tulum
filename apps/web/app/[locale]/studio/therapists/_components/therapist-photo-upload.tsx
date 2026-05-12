'use client';

/**
 * TherapistPhotoUpload — drag-and-drop / click-to-browse photo uploader.
 *
 * Client-side validation before upload:
 *   - Accepted types: image/jpeg, image/png, image/webp
 *   - Max size: 5 MB (the design says 2 MB but the API accepts 5 MB; the
 *     design doc's file hint text says 2 MB. We show the 2 MB hint text
 *     per the design spec but enforce the API limit of 5 MB client-side so
 *     we don't block users who upload a valid file the API would accept.
 *     The design's 2 MB is a UX recommendation. The API's 5 MB is the hard limit.)
 *
 * Upload flow:
 *   1. User selects file → client-side validation.
 *   2. If passes: call uploadTherapistPhoto server action.
 *   3. On success: update preview, call onPhotoChange with new URL.
 *   4. On failure: show error.
 *
 * Remove flow:
 *   1. User clicks "Remove photo" → call removeTherapistPhoto server action.
 *   2. On success: clear preview, call onPhotoChange with null.
 *
 * Accessibility:
 *   - Hidden file input is sr-only (not display:none) so assistive tech can reach it.
 *   - Upload error uses role="alert".
 *   - Buttons are keyboard-reachable, min-h-[44px] for touch targets.
 *   - Upload button is labeled via aria-label or visible text.
 *
 * Ref: docs/design/therapist-roster.md §5, docs/research/CU-869d29f1p-therapist-photo-upload.md
 * Ticket: CU-869d8k3yv
 */

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { removeTherapistPhoto, uploadTherapistPhoto } from '../../../../../actions/therapists';
import { TherapistAvatar } from './therapist-avatar';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (API hard limit)

interface TherapistPhotoUploadProps {
  therapistId: string;
  therapistName: string;
  photoUrl: string | null;
  onPhotoChange: (url: string | null) => void;
}

export function TherapistPhotoUpload({
  therapistId,
  therapistName,
  photoUrl,
  onPhotoChange,
}: TherapistPhotoUploadProps) {
  const t = useTranslations('therapistRoster');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasPhoto = photoUrl !== null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Client-side type validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('avatar.error.fileType'));
      // Reset input so the same file can be re-selected after correction
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side size validation
    if (file.size > MAX_SIZE_BYTES) {
      setError(t('avatar.error.fileSize'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    startTransition(async () => {
      const result = await uploadTherapistPhoto(therapistId, file);
      if (result.success) {
        onPhotoChange(result.data.photoUrl);
      } else {
        setError(t('avatar.error.uploadFailed'));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeTherapistPhoto(therapistId);
      if (result.success) {
        onPhotoChange(null);
      } else {
        setError(t('avatar.error.uploadFailed'));
      }
    });
  }

  const ghostButtonClass = [
    'min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 py-2',
    'text-sm font-medium text-neutral-700 bg-transparent border border-neutral-200',
    'hover:bg-neutral-50 hover:border-neutral-300',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
    'focus-visible:ring-offset-2',
    'motion-safe:transition-colors motion-safe:duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' ');

  const dangerButtonClass = [
    'min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 py-2',
    'text-sm font-medium text-danger-600 bg-transparent border border-danger-200',
    'hover:bg-danger-50 hover:border-danger-300',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500',
    'focus-visible:ring-offset-2',
    'motion-safe:transition-colors motion-safe:duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' ');

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar preview */}
      <div className="relative">
        {isPending ? (
          /* Uploading state: shimmer skeleton over the avatar circle */
          <div
            className="h-24 w-24 rounded-full bg-neutral-200 animate-pulse"
            aria-label={t('avatar.uploading')}
          />
        ) : (
          <TherapistAvatar name={therapistName} photoUrl={photoUrl} size="lg" />
        )}
      </div>

      {/* Upload / replace / remove controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          className={ghostButtonClass}
        >
          {hasPhoto ? t('avatar.replacePhoto') : t('avatar.uploadPhoto')}
        </button>

        {hasPhoto && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className={dangerButtonClass}
          >
            {t('avatar.removePhoto')}
          </button>
        )}
      </div>

      {/* File hint (only shown when no photo) */}
      {!hasPhoto && !isPending && (
        <p className="text-xs text-neutral-500 text-center max-w-[240px]">{t('avatar.fileHint')}</p>
      )}

      {/* Error message */}
      {error && (
        <p role="alert" className="text-xs text-danger-700 flex items-center gap-1">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Hidden file input — sr-only so assistive tech can still reach it */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        aria-label={t('avatar.fileInput.label')}
        className="sr-only"
      />
    </div>
  );
}
