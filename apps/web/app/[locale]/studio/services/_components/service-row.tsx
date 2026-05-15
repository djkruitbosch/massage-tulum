'use client';

/**
 * ServiceRow — a single service in the list.
 *
 * Desktop: horizontal flex row. Name + category + duration/price on left. Actions right.
 * Mobile (<768px): flex-col.
 *   - Line 1: name + category pill (inline)
 *   - Line 2: duration · price (text-sm)
 *   - Line 3: action buttons (right-aligned)
 *
 * Active service row: Edit + Deactivate buttons.
 * Inactive service row: Reactivate button only (no Edit in v1).
 *
 * StatusPill: shown only on "All" and "Deactivated" filters.
 * CategoryPill: shown if category is non-null.
 *
 * Ref: docs/design/service-catalog.md §4
 * Ticket: CU-869d29f21
 */

import type { ServiceResponse } from '@massage-tulum/shared';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDurationMinutes, formatMxnPrice } from '../../../../../lib/format';
import { StatusPill } from './status-pill';

interface ServiceRowProps {
  service: ServiceResponse;
  showStatus: boolean;
  locale: string;
  onEdit: (service: ServiceResponse) => void;
  onDeactivate: (service: ServiceResponse) => void;
  onReactivate: (service: ServiceResponse) => void;
}

export function ServiceRow({
  service,
  showStatus,
  locale,
  onEdit,
  onDeactivate,
  onReactivate,
}: ServiceRowProps) {
  const t = useTranslations('serviceCatalog');

  const isActive = service.status === 'active';
  const durationText = formatDurationMinutes(service.durationMinutes);
  const priceText = formatMxnPrice(service.basePriceMxn, locale);

  const actionButtonBase = [
    'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg p-2',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-offset-2',
    'motion-safe:transition-colors motion-safe:duration-150',
  ].join(' ');

  return (
    <li className="py-4 border-b border-neutral-100 last:border-b-0">
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-between gap-3">
        {/* Left: service info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-medium text-neutral-800 truncate">{service.name}</span>
            {service.category && (
              <span className="rounded bg-brand-100 text-brand-700 text-xs font-medium px-2 py-0.5 shrink-0">
                {service.category}
              </span>
            )}
            {showStatus && <StatusPill status={service.status} />}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {durationText}
            <span className="mx-1 text-neutral-300" aria-hidden="true">
              ·
            </span>
            {priceText}
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(service)}
                aria-label={t('action.edit', { name: service.name })}
                className={[
                  actionButtonBase,
                  'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
                  'focus-visible:ring-brand-600',
                ].join(' ')}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeactivate(service)}
                aria-label={t('action.deactivate', { name: service.name })}
                className={[
                  actionButtonBase,
                  'text-danger-500 hover:text-danger-700 hover:bg-danger-50',
                  'focus-visible:ring-danger-500',
                ].join(' ')}
              >
                <EyeOff size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(service)}
              aria-label={t('action.reactivate', { name: service.name })}
              className={[
                actionButtonBase,
                'text-success-500 hover:text-success-700 hover:bg-success-50',
                'focus-visible:ring-success-500',
              ].join(' ')}
            >
              <Eye size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col gap-2 sm:hidden">
        {/* Line 1: name + category pill */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-base font-medium text-neutral-800 truncate">{service.name}</span>
          {service.category && (
            <span className="rounded bg-brand-100 text-brand-700 text-xs font-medium px-2 py-0.5 shrink-0">
              {service.category}
            </span>
          )}
          {showStatus && <StatusPill status={service.status} />}
        </div>

        {/* Line 2: duration · price */}
        <p className="text-sm text-neutral-500">
          {durationText}
          <span className="mx-1 text-neutral-300" aria-hidden="true">
            ·
          </span>
          {priceText}
        </p>

        {/* Line 3: actions right-aligned */}
        <div className="flex items-center justify-end gap-1">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(service)}
                aria-label={t('action.edit', { name: service.name })}
                className={[
                  actionButtonBase,
                  'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
                  'focus-visible:ring-brand-600',
                ].join(' ')}
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeactivate(service)}
                aria-label={t('action.deactivate', { name: service.name })}
                className={[
                  actionButtonBase,
                  'text-danger-500 hover:text-danger-700 hover:bg-danger-50',
                  'focus-visible:ring-danger-500',
                ].join(' ')}
              >
                <EyeOff size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onReactivate(service)}
              aria-label={t('action.reactivate', { name: service.name })}
              className={[
                actionButtonBase,
                'text-success-500 hover:text-success-700 hover:bg-success-50',
                'focus-visible:ring-success-500',
              ].join(' ')}
            >
              <Eye size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
