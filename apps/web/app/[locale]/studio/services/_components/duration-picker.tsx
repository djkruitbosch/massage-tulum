'use client';

/**
 * DurationPicker — preset chip group for selecting service duration.
 *
 * Presets: 30, 45, 60, 75, 90, 105, 120, 150, 180 minutes.
 * Plus "Custom…" chip that shows an inline number input.
 *
 * Each chip is <button type="button" aria-pressed> for toggle button semantics.
 * The group has role="group" with aria-labelledby.
 * Custom input has aria-label for screen reader context.
 *
 * On Edit:
 *   - If value matches a preset → that preset chip is pre-selected.
 *   - If value does not match → "Custom…" is selected, input shows the value.
 *
 * Default on Add: 60 min pre-selected.
 *
 * Ref: docs/design/service-catalog.md §5
 * Ticket: CU-869d29f21
 */

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDurationMinutes } from '../../../../../lib/format';

const PRESETS = [30, 45, 60, 75, 90, 105, 120, 150, 180];

interface DurationPickerProps {
  value: number | null | undefined;
  onChange: (minutes: number | null) => void;
  error?: string;
}

export function DurationPicker({ value, onChange, error }: DurationPickerProps) {
  const t = useTranslations('serviceCatalog');
  const groupLabelId = useId();
  const errorId = useId();
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Determine initial chip selection
  const isPreset = (v: number | null | undefined): boolean => v != null && PRESETS.includes(v);

  const [useCustom, setUseCustom] = useState<boolean>(() => {
    if (value == null) return false;
    return !isPreset(value);
  });

  const [customValue, setCustomValue] = useState<string>(() => {
    if (value != null && !isPreset(value)) return String(value);
    return '';
  });

  // Sync when value changes externally (e.g. edit modal pre-fill)
  useEffect(() => {
    if (value != null && !isPreset(value)) {
      setUseCustom(true);
      setCustomValue(String(value));
    } else if (value != null && isPreset(value)) {
      setUseCustom(false);
    }
  }, [value]);

  // Auto-focus custom input when "Custom…" is selected
  useEffect(() => {
    if (useCustom) {
      customInputRef.current?.focus();
    }
  }, [useCustom]);

  function handlePresetClick(minutes: number) {
    setUseCustom(false);
    setCustomValue('');
    onChange(minutes);
  }

  function handleCustomChipClick() {
    setUseCustom(true);
    // If there's already a custom value, keep it. Otherwise clear.
    const parsed = parseInt(customValue, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChange(parsed);
    } else {
      onChange(null);
    }
  }

  function handleCustomInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setCustomValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      onChange(parsed);
    } else {
      onChange(null);
    }
  }

  const activePreset = !useCustom && value != null && isPreset(value) ? value : null;

  const chipClass = (active: boolean) =>
    [
      'px-3 py-1.5 rounded-lg text-sm font-medium border',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
      'focus-visible:ring-offset-2',
      'motion-safe:transition-colors motion-safe:duration-150',
      active
        ? 'bg-brand-700 text-white border-brand-700'
        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300',
    ].join(' ');

  return (
    <div>
      <div
        role="group"
        aria-labelledby={groupLabelId}
        aria-describedby={error ? errorId : undefined}
        className="flex flex-wrap gap-2"
      >
        <span id={groupLabelId} className="sr-only">
          {t('field.duration.label')}
        </span>

        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={activePreset === preset}
            onClick={() => handlePresetClick(preset)}
            className={chipClass(activePreset === preset)}
          >
            {formatDurationMinutes(preset)}
          </button>
        ))}

        {/* Custom chip */}
        <button
          type="button"
          aria-pressed={useCustom}
          onClick={handleCustomChipClick}
          className={chipClass(useCustom)}
        >
          {t('field.duration.custom')}
        </button>
      </div>

      {/* Custom input — shown when "Custom…" is selected */}
      {useCustom && (
        <div className="mt-2">
          <input
            ref={customInputRef}
            type="number"
            min="1"
            max="480"
            step="1"
            value={customValue}
            onChange={handleCustomInputChange}
            aria-label={t('field.duration.customLabel')}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            placeholder="1"
            className={[
              'h-10 w-full max-w-xs rounded-lg border px-3 text-sm text-neutral-800 bg-white',
              'placeholder:text-neutral-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'focus-visible:ring-offset-2',
              'motion-safe:transition-colors motion-safe:duration-150',
              error
                ? 'border-danger-500 focus-visible:ring-danger-500'
                : 'border-neutral-200 hover:border-neutral-300',
            ].join(' ')}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-danger-700 flex items-center gap-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}
