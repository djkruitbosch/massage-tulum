'use client';

/**
 * PageHeader — page title + primary action button.
 *
 * Renders the Studio Profile page header with title, subtitle, and
 * save/cancel buttons. Receives isLoading and onCancel from the form.
 *
 * Desktop: title+subtitle left, buttons right (flex row).
 * Mobile (<sm): title+subtitle stacked above full-width buttons.
 *
 * Ref: docs/design/studio-profile.md §5
 * Ticket: CU-869d8cp2d
 */

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PageHeaderProps {
  isLoading: boolean;
  onCancel: () => void;
}

export function PageHeader({ isLoading, onCancel }: PageHeaderProps) {
  const t = useTranslations('studioProfile');

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-heading text-xl font-bold text-neutral-800 sm:text-2xl">
          {t('page.title')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t('page.subtitle')}</p>
      </div>

      {/* Action buttons — stacked below title on mobile, inline on sm+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className={[
            'h-10 rounded-lg border border-neutral-200 bg-white px-4',
            'text-sm font-medium text-neutral-700',
            'hover:bg-neutral-50 hover:border-neutral-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:pointer-events-none disabled:opacity-50',
            'w-full sm:w-auto',
          ].join(' ')}
        >
          {t('action.cancel')}
        </button>

        <button
          type="submit"
          form="studio-profile-form"
          disabled={isLoading}
          className={[
            'h-10 rounded-lg bg-brand-700 px-4',
            'text-sm font-medium text-white',
            'hover:bg-brand-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:pointer-events-none disabled:opacity-80',
            'flex items-center justify-center gap-2',
            'w-full sm:w-auto',
          ].join(' ')}
          aria-busy={isLoading}
        >
          {isLoading && (
            <Loader2 size={16} className="motion-safe:animate-spin shrink-0" aria-hidden="true" />
          )}
          {t('action.save')}
        </button>
      </div>
    </div>
  );
}
