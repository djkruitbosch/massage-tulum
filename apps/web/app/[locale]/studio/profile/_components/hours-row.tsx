'use client';

/**
 * HoursRow — single day row in the operating hours grid.
 *
 * Renders the day label, closed/open toggle (role="switch"), and
 * conditional TimePicker components for open/close times.
 *
 * Accessibility:
 *   - Closed switch has role="switch" + aria-checked + aria-label with full day name.
 *   - Space key toggles the switch (native button behavior).
 *   - Time pickers are hidden (not just invisible) when day is closed.
 *   - Close-after-open error announced via aria-describedby on close time picker.
 *
 * Mobile layout: day label + toggle on row 1; time pickers on row 2
 * (flex-wrap handles this automatically).
 *
 * Ref: docs/design/studio-profile.md §6 (Hours Section)
 * Ticket: CU-869d8cp2d
 */

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { TimePicker } from './time-picker';

interface HoursRowProps {
  /** ISO weekday number 1–7 */
  weekday: number;
  /** Full day name for accessibility (e.g., "Monday") */
  fullDayName: string;
  /** Short day label for display (e.g., "Mon") */
  shortDayName: string;
  isOpen: boolean;
  openTime: string | null | undefined;
  closeTime: string | null | undefined;
  /** Called when the closed/open toggle changes */
  onToggle: (isOpen: boolean) => void;
  onOpenTimeChange: (value: string) => void;
  onCloseTimeChange: (value: string) => void;
  /** Close-after-open error message (from react-hook-form field error) */
  closeAfterOpenError?: string;
}

export function HoursRow({
  weekday,
  fullDayName,
  shortDayName,
  isOpen,
  openTime,
  closeTime,
  onToggle,
  onOpenTimeChange,
  onCloseTimeChange,
  closeAfterOpenError,
}: HoursRowProps) {
  const t = useTranslations('studioProfile.hours');
  const errorId = useId();
  const toggleId = `hours-toggle-${weekday}`;

  const toggleLabel = isOpen
    ? t('toggleClosed.label', { day: fullDayName })
    : t('toggleOpen.label', { day: fullDayName });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 border-b border-neutral-100 last:border-b-0">
      {/* Day label */}
      <div className="w-28 shrink-0">
        {/* Full name on sm+, short name on mobile */}
        <span className="hidden sm:block text-sm font-medium text-neutral-700">{fullDayName}</span>
        <span className="sm:hidden text-sm font-medium text-neutral-700">{shortDayName}</span>
      </div>

      {/* Closed / open switch */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={!isOpen}
          aria-label={toggleLabel}
          onClick={() => onToggle(!isOpen)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            !isOpen ? 'bg-neutral-300' : 'bg-brand-600',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm',
              'ring-0',
              'motion-safe:transition-transform motion-safe:duration-150',
              !isOpen ? 'translate-x-0' : 'translate-x-5',
            ].join(' ')}
          />
        </button>
        <span className="text-sm text-neutral-500 select-none" aria-hidden="true">
          {!isOpen ? t('closed') : t('open')}
        </span>
      </div>

      {/* Time pickers — shown only when day is open */}
      {isOpen && (
        <div className="flex flex-wrap items-end gap-2 grow">
          <TimePicker
            value={openTime}
            onChange={onOpenTimeChange}
            label={t('open')}
            id={`open-time-${weekday}`}
          />

          <span className="text-sm text-neutral-400 pb-2.5" aria-hidden="true">
            &ndash;
          </span>

          <TimePicker
            value={closeTime}
            onChange={onCloseTimeChange}
            label={t('close')}
            id={`close-time-${weekday}`}
            hasError={!!closeAfterOpenError}
            errorId={closeAfterOpenError ? errorId : undefined}
          />
        </div>
      )}

      {/* Closed indicator — shown only when day is closed */}
      {!isOpen && (
        <span className="text-sm text-neutral-400 italic" aria-hidden="true">
          {t('closedLabel')}
        </span>
      )}

      {/* Validation error for close-after-open */}
      {isOpen && closeAfterOpenError && (
        <p
          id={errorId}
          role="alert"
          className="w-full text-xs text-danger-700 flex items-center gap-1"
        >
          <span aria-hidden="true">&#9888;</span>
          {closeAfterOpenError}
        </p>
      )}
    </div>
  );
}
