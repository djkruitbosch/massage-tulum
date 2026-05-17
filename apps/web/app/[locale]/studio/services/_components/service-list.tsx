'use client';

/**
 * ServiceList — orchestrating client component for the service catalog page.
 *
 * Responsibilities:
 *   - FilterBar (Active / Deactivated / All) — filter change triggers re-fetch.
 *   - "Add service" button that opens ServiceFormModal.
 *   - List of ServiceRow components.
 *   - Loading skeleton (5 rows) while fetching.
 *   - Empty states (per filter and per design).
 *   - Error state with retry.
 *   - Modals: ServiceFormModal (add/edit), DeactivateConfirmModal, ReactivateConfirmModal.
 *   - Toast notifications for success / error.
 *   - Local optimistic updates after mutations.
 *
 * Filter strategy: on filter change, calls listServices() server action (server-side filter).
 * This differs from the therapists pattern (which loads all and filters client-side) —
 * documented in arch doc §5d and open question #3. For ≤50 services either is acceptable;
 * this implementation uses server-side re-fetch for consistency with the default active filter.
 *
 * Ref: docs/design/service-catalog.md §2, §4, §9
 * Ref: docs/architecture/CU-869d29f21-service-catalog.md §5
 * Ticket: CU-869d29f21
 */

import type { ServiceResponse } from '@massage-tulum/shared';
import { AlertCircle, CheckCircle, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState, useTransition } from 'react';
import { listServices } from '../../../../../actions/services';
import { DeactivateConfirmModal } from './deactivate-confirm-modal';
import { FilterBar } from './filter-bar';
import { ReactivateConfirmModal } from './reactivate-confirm-modal';
import { ServiceFormModal } from './service-form-modal';
import { ServiceRow } from './service-row';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterValue = 'active' | 'inactive' | 'all';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; service: ServiceResponse }
  | { type: 'deactivate'; service: ServiceResponse }
  | { type: 'reactivate'; service: ServiceResponse };

interface ToastState {
  id: string;
  variant: 'success' | 'error';
  title: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ServiceListProps {
  initialServices: ServiceResponse[];
  initialFilter: FilterValue;
  locale: string;
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="py-4 border-b border-neutral-100 last:border-b-0" aria-hidden="true">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-44 rounded bg-neutral-200 animate-pulse" />
              <div className="h-3 w-20 rounded bg-neutral-200 animate-pulse" />
              <div className="h-3.5 w-36 rounded bg-neutral-200 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded bg-neutral-200 animate-pulse" />
          </div>
        </li>
      ))}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ServiceList({ initialServices, initialFilter, locale }: ServiceListProps) {
  const t = useTranslations('serviceCatalog');
  const tCommon = useTranslations('common');
  const tToast = useTranslations('toast');

  const [services, setServices] = useState<ServiceResponse[]>(initialServices);
  const [filter, setFilter] = useState<FilterValue>(initialFilter);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [isPending, startTransition] = useTransition();

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for focus restoration
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const editButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const deactivateButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const reactivateButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── Toast helpers ───────────────────────────────────────────────────────────

  const showToast = useCallback((variant: 'success' | 'error', title: string) => {
    setToast({ id: Math.random().toString(36).slice(2), variant, title });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Filter + re-fetch ───────────────────────────────────────────────────────

  function handleFilterChange(newFilter: FilterValue) {
    setFilter(newFilter);
    setLoadError(false);
    setIsLoading(true);

    startTransition(async () => {
      const result = await listServices(newFilter);
      setIsLoading(false);
      if (result.success) {
        setServices(result.data);
      } else {
        setLoadError(true);
      }
    });
  }

  function handleRetry() {
    handleFilterChange(filter);
  }

  // ── Modal open/close helpers ────────────────────────────────────────────────

  function openAdd() {
    setModal({ type: 'add' });
  }

  function openEdit(service: ServiceResponse) {
    setModal({ type: 'edit', service });
  }

  function openDeactivate(service: ServiceResponse) {
    setModal({ type: 'deactivate', service });
  }

  function openReactivate(service: ServiceResponse) {
    setModal({ type: 'reactivate', service });
  }

  function closeModal() {
    const prev = modal;
    setModal({ type: 'none' });

    requestAnimationFrame(() => {
      if (prev.type === 'add') {
        addButtonRef.current?.focus();
      } else if (prev.type === 'edit') {
        editButtonRefs.current.get(prev.service.id)?.focus();
      } else if (prev.type === 'deactivate') {
        deactivateButtonRefs.current.get(prev.service.id)?.focus();
      } else if (prev.type === 'reactivate') {
        reactivateButtonRefs.current.get(prev.service.id)?.focus();
      }
    });
  }

  // ── Mutation handlers ───────────────────────────────────────────────────────

  function handleAddSuccess(newService: ServiceResponse) {
    setServices((prev) => {
      if (filter === 'inactive') return prev;
      return [newService, ...prev];
    });
    closeModal();
    showToast('success', t('toast.created'));
  }

  function handleEditSuccess(updated: ServiceResponse) {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    closeModal();
    showToast('success', t('toast.updated'));
  }

  function handleDeactivateSuccess(updated: ServiceResponse) {
    setServices((prev) => {
      if (filter === 'all') {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      }
      return prev.filter((s) => s.id !== updated.id);
    });
    closeModal();
    showToast('success', t('toast.deactivated'));
  }

  function handleReactivateSuccess(updated: ServiceResponse) {
    setServices((prev) => {
      if (filter === 'all') {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      }
      return prev.filter((s) => s.id !== updated.id);
    });
    closeModal();
    showToast('success', t('toast.reactivated'));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isEmpty = !isLoading && !loadError && services.length === 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-neutral-800">{t('page.title')}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t('page.subtitle')}</p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          onClick={openAdd}
          className={[
            'inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5',
            'text-sm font-medium text-white',
            'hover:bg-brand-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
            'shrink-0 w-full sm:w-auto justify-center',
          ].join(' ')}
        >
          {t('action.addService')}
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar value={filter} onChange={handleFilterChange} />

      {/* Load error */}
      {loadError && !isLoading && (
        <div
          className="flex gap-3 rounded-lg border-l-4 border-danger-500 bg-danger-50 p-6"
          role="alert"
        >
          <AlertCircle size={20} className="text-danger-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-700">{t('loadError.title')}</p>
            <p className="mt-1 text-sm text-neutral-500">{t('loadError.body')}</p>
            <button
              type="button"
              onClick={handleRetry}
              className={[
                'mt-3 inline-flex items-center rounded-lg border border-neutral-200',
                'bg-white px-4 py-2 text-sm font-medium text-neutral-700',
                'hover:bg-neutral-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2',
              ].join(' ')}
            >
              {tCommon('button.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <ul aria-busy="true" aria-label={t('loading')} aria-live="polite" className="divide-y-0">
          <SkeletonRows />
        </ul>
      )}

      {/* Empty state */}
      {isEmpty && <EmptyState filter={filter} onAdd={openAdd} />}

      {/* Service list */}
      {!isLoading && !loadError && services.length > 0 && (
        <ul role="list" aria-label={t('list.label')} className="divide-y-0">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              showStatus={filter === 'all' || filter === 'inactive'}
              locale={locale}
              onEdit={(s) => openEdit(s)}
              onDeactivate={(s) => openDeactivate(s)}
              onReactivate={(s) => openReactivate(s)}
            />
          ))}
        </ul>
      )}

      {/* Modals */}
      {modal.type === 'add' && (
        <ServiceFormModal locale={locale} onSuccess={handleAddSuccess} onClose={closeModal} />
      )}
      {modal.type === 'edit' && (
        <ServiceFormModal
          initialData={modal.service}
          locale={locale}
          onSuccess={handleEditSuccess}
          onClose={closeModal}
        />
      )}
      {modal.type === 'deactivate' && (
        <DeactivateConfirmModal
          service={modal.service}
          onSuccess={handleDeactivateSuccess}
          onClose={closeModal}
        />
      )}
      {modal.type === 'reactivate' && (
        <ReactivateConfirmModal
          service={modal.service}
          onSuccess={handleReactivateSuccess}
          onClose={closeModal}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={[
            'fixed bottom-4 right-4 z-50 max-w-sm rounded-lg shadow-lg border p-4',
            toast.variant === 'success'
              ? 'bg-white border-success-500 text-neutral-800'
              : 'bg-white border-danger-500 text-neutral-800',
          ].join(' ')}
        >
          <p className="font-medium text-sm">{toast.title}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className={[
              'absolute right-2 top-2 rounded p-1 text-neutral-400',
              'hover:text-neutral-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            ].join(' ')}
            aria-label={tToast('dismiss')}
          >
            &times;
          </button>
        </div>
      )}

      {/* Suppress unused isPending warning — used in handleFilterChange */}
      {isPending && <span className="sr-only" aria-hidden="true" />}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  filter: FilterValue;
  onAdd: () => void;
}

function EmptyState({ filter, onAdd }: EmptyStateProps) {
  const t = useTranslations('serviceCatalog');
  const isDeactivated = filter === 'inactive';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {isDeactivated ? (
        <CheckCircle size={48} className="text-neutral-300" aria-hidden="true" />
      ) : (
        <Tag size={48} className="text-neutral-300" aria-hidden="true" />
      )}

      <p className="mt-4 text-lg font-medium text-neutral-500">
        {isDeactivated ? t('empty.deactivated.title') : t('empty.active.title')}
      </p>
      <p className="mt-2 text-sm text-neutral-400">
        {isDeactivated ? t('empty.deactivated.body') : t('empty.active.body')}
      </p>

      {!isDeactivated && (
        <button
          type="button"
          onClick={onAdd}
          className={[
            'mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5',
            'text-sm font-medium text-white',
            'hover:bg-brand-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2',
            'motion-safe:transition-colors motion-safe:duration-150',
          ].join(' ')}
        >
          {t('action.addService')}
        </button>
      )}
    </div>
  );
}
