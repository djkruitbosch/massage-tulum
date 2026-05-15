'use client';

/**
 * FilterBar — Active / Deactivated / All segment for service list.
 *
 * Each button uses aria-pressed to convey the selected state.
 * The group has role="group" with aria-label.
 * Overflow-x-auto handles narrow viewports.
 *
 * Ref: docs/design/service-catalog.md §4
 * Ticket: CU-869d29f21
 */

import { useTranslations } from 'next-intl';

type FilterValue = 'active' | 'inactive' | 'all';

interface FilterBarProps {
  value: FilterValue;
  onChange: (filter: FilterValue) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  const t = useTranslations('serviceCatalog');

  const tabClass = (active: boolean) =>
    [
      'px-4 py-2 rounded-lg text-sm font-medium',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
      'focus-visible:ring-offset-2',
      'motion-safe:transition-colors motion-safe:duration-150',
      'whitespace-nowrap',
      active
        ? 'bg-brand-700 text-white'
        : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50',
    ].join(' ');

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-2" role="group" aria-label={t('filter.groupLabel')}>
        <button
          type="button"
          onClick={() => onChange('active')}
          aria-pressed={value === 'active'}
          className={tabClass(value === 'active')}
        >
          {t('filter.active')}
        </button>
        <button
          type="button"
          onClick={() => onChange('inactive')}
          aria-pressed={value === 'inactive'}
          className={tabClass(value === 'inactive')}
        >
          {t('filter.inactive')}
        </button>
        <button
          type="button"
          onClick={() => onChange('all')}
          aria-pressed={value === 'all'}
          className={tabClass(value === 'all')}
        >
          {t('filter.all')}
        </button>
      </div>
    </div>
  );
}
