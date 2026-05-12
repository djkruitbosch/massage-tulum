'use client';

/**
 * TherapistAvatar — renders either a photo or an initials avatar.
 *
 * When photoUrl is a non-null string:
 *   - Renders <img> with loading="lazy", alt="" (decorative — the parent row
 *     expresses the name via aria-label), and an onError handler that falls
 *     back to initials if the signed URL has expired or the image fails to load.
 *
 * When photoUrl is null (or image fails to load):
 *   - Renders a coloured circle with initials derived from `name`.
 *   - Initials: first letter of first word + first letter of last word (split on space).
 *     Single-word names → first letter only.
 *   - Background: brand-100, text: brand-700 (~6.2:1 contrast — design token pair).
 *
 * Sizes:
 *   - "sm" → h-8 w-8 (32px) — used in list rows
 *   - "lg" → h-24 w-24 (96px) — used in modal form header
 *
 * Accessibility:
 *   - The outer div has role="img" and aria-label={name} (or the provided ariaLabel).
 *   - The <img> has alt="" (decorative; parent supplies accessible name).
 *   - The initials <span> has aria-hidden="true" (role="img" on the wrapper covers it).
 *
 * Ref: docs/design/therapist-roster.md §4, docs/research/CU-869d29f1p-therapist-photo-upload.md §8
 * Ticket: CU-869d8k3yv
 */

import { useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]![0] ?? '').toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TherapistAvatarProps {
  name: string;
  photoUrl: string | null;
  size?: 'sm' | 'lg';
  /** Override the accessible label on the wrapper (defaults to name). */
  ariaLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TherapistAvatar({ name, photoUrl, size = 'sm', ariaLabel }: TherapistAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClasses = size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-8 w-8 text-xs';
  const initials = getInitials(name);
  const label = ariaLabel ?? name;

  const showPhoto = photoUrl !== null && !imgFailed;

  return (
    <div
      role="img"
      aria-label={label}
      className={[
        sizeClasses,
        'rounded-full flex-shrink-0 overflow-hidden',
        showPhoto ? '' : 'bg-brand-100 flex items-center justify-center',
      ].join(' ')}
    >
      {showPhoto ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span aria-hidden="true" className="font-semibold text-brand-700 leading-none select-none">
          {initials}
        </span>
      )}
    </div>
  );
}
