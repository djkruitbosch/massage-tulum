'use client';

/**
 * TimePicker — accessible 12-hour time picker wrapper.
 *
 * Wraps <input type="time"> which stores values in HH:MM 24-hour format
 * internally. The accessible label uses 12-hour formatting via
 * Intl.DateTimeFormat to give screen readers a human-friendly description.
 *
 * CSP-safe: no inline scripts, no third-party libraries.
 * Keyboard: native browser time input (arrow keys, AM/PM toggle).
 * Mobile: falls back to native system time picker (iOS/Android).
 *
 * Ref: docs/architecture/CU-869d29f1h-studio-profile.md §4e
 * Ref: docs/adr/0012-business-hours-time-storage.md
 * Ticket: CU-869d8cp2d
 */

import { useId } from 'react';

interface TimePickerProps {
  /** HH:MM (24-hour) value — null when not set */
  value: string | null | undefined;
  /** Called with HH:MM (24-hour) string or empty string on clear */
  onChange: (value: string) => void;
  /** Accessible label shown above the input */
  label: string;
  /** Unique element id (auto-generated if not provided) */
  id?: string;
  /** Whether to show an error state */
  hasError?: boolean;
  /** Id of the error element to link via aria-describedby */
  errorId?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * Format a HH:MM time string into a 12-hour display string.
 * Used for aria-label enhancement. Example: "14:30" → "2:30 PM"
 */
function formatAs12h(hhMm: string): string {
  // Parse HH:MM
  const colonIndex = hhMm.indexOf(':');
  if (colonIndex === -1) return hhMm;
  const hours = parseInt(hhMm.slice(0, colonIndex), 10);
  const minutes = hhMm.slice(colonIndex + 1);
  if (Number.isNaN(hours)) return hhMm;

  // Build a Date in a fixed UTC date so Intl doesn't shift by timezone
  const d = new Date(Date.UTC(2000, 0, 1, hours, parseInt(minutes, 10), 0));
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return hhMm;
  }
}

export function TimePicker({
  value,
  onChange,
  label,
  id: externalId,
  hasError = false,
  errorId,
  disabled = false,
}: TimePickerProps) {
  const autoId = useId();
  const inputId = externalId ?? autoId;

  const displayValue = value ?? '';
  const ariaLabel = displayValue ? `${label}: ${formatAs12h(displayValue)}` : label;

  const describedBy = errorId && hasError ? errorId : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={inputId}
        type="time"
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={[
          'h-10 rounded-lg border px-3 text-sm text-neutral-800 bg-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          'focus-visible:ring-offset-2',
          'motion-safe:transition-colors motion-safe:duration-150',
          'disabled:bg-neutral-50 disabled:text-neutral-400 disabled:pointer-events-none',
          hasError
            ? 'border-danger-500 focus-visible:ring-danger-500'
            : 'border-neutral-200 hover:border-neutral-300',
        ].join(' ')}
      />
    </div>
  );
}
