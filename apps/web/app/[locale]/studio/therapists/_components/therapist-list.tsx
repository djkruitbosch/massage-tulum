'use client';

/**
 * TherapistList — orchestrating client component for the therapist roster page.
 *
 * Responsibilities:
 *   - Filter bar (Active / Deactivated / All) that updates the URL ?status param
 *     using the router so the server component re-fetches on navigation.
 *   - "Add therapist" button that opens AddTherapistModal.
 *   - List of TherapistRow components.
 *   - Empty states (per filter and per design).
 *   - Error state with retry button.
 *   - Loading skeleton (3 rows) while data is being fetched (initial load).
 *   - Modals: AddTherapistModal, EditTherapistModal, DeactivateTherapistDialog,
 *     ReactivateTherapistDialog. Each is opened in response to user actions.
 *   - Toast notifications for success / error.
 *   - Local optimistic updates: after a mutation succeeds, update the in-memory
 *     list so the user sees immediate feedback without a full page reload.
 *
 * State note: uses router.push to update URL params → triggers Next.js server
 * component re-render which re-fetches data from the API. For in-session mutations
 * (add/edit/deactivate/reactivate) we also update local state optimistically.
 *
 * Ref: docs/design/therapist-roster.md §2, §4, §8
 * Ticket: CU-869d8k3yv
 */

import type { Therapist } from '@massage-tulum/shared';
import { AlertCircle, Users, UserCheck as UserCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AddTherapistModal } from './add-therapist-modal';
import { DeactivateTherapistDialog } from './deactivate-therapist-dialog';
import { EditTherapistModal } from './edit-therapist-modal';
import { ReactivateTherapistDialog } from './reactivate-therapist-dialog';
import { TherapistRow } from './therapist-row';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterValue = 'active' | 'inactive' | 'all';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; therapist: Therapist }
  | { type: 'deactivate'; therapist: Therapist }
  | { type: 'reactivate'; therapist: Therapist };

interface ToastState {
  id: string;
  variant: 'success' | 'error';
  title: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface TherapistListProps {
  initialTherapists: Therapist[];
  initialFilter: FilterValue;
  locale: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TherapistList({ initialTherapists, initialFilter, locale }: TherapistListProps) {
  const t = useTranslations('therapistRoster');
  const tToast = useTranslations('toast');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [therapists, setTherapists] = useState<Therapist[]>(initialTherapists);
  const [filter, setFilter] = useState<FilterValue>(initialFilter);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for restoring focus after modal close
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

  // ── Filter ──────────────────────────────────────────────────────────────────

  function handleFilterChange(newFilter: FilterValue) {
    setFilter(newFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', newFilter);
    router.push(`?${params.toString()}`);
  }

  // ── Modal open/close helpers ────────────────────────────────────────────────

  function openAdd() {
    setModal({ type: 'add' });
  }

  function openEdit(therapist: Therapist) {
    setModal({ type: 'edit', therapist });
  }

  function openDeactivate(therapist: Therapist) {
    setModal({ type: 'deactivate', therapist });
  }

  function openReactivate(therapist: Therapist) {
    setModal({ type: 'reactivate', therapist });
  }

  function closeModal() {
    const prev = modal;
    setModal({ type: 'none' });

    // Restore focus to the trigger element
    requestAnimationFrame(() => {
      if (prev.type === 'add') {
        addButtonRef.current?.focus();
      } else if (prev.type === 'edit') {
        editButtonRefs.current.get(prev.therapist.id)?.focus();
      } else if (prev.type === 'deactivate') {
        deactivateButtonRefs.current.get(prev.therapist.id)?.focus();
      } else if (prev.type === 'reactivate') {
        reactivateButtonRefs.current.get(prev.therapist.id)?.focus();
      }
    });
  }

  // ── Mutation handlers ───────────────────────────────────────────────────────

  function handleAddSuccess(newTherapist: Therapist) {
    setTherapists((prev) => {
      // Add to top of list; if current filter is 'inactive', don't show (active only)
      if (filter === 'inactive') return prev;
      return [newTherapist, ...prev];
    });
    closeModal();
    showToast('success', tToast('success.saved.title'));
  }

  function handleEditSuccess(updated: Therapist) {
    setTherapists((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    closeModal();
    showToast('success', tToast('success.saved.title'));
  }

  function handleDeactivateSuccess(updated: Therapist) {
    setTherapists((prev) => {
      if (filter === 'all') {
        return prev.map((t) => (t.id === updated.id ? updated : t));
      }
      // In 'active' filter: remove the now-inactive therapist
      return prev.filter((t) => t.id !== updated.id);
    });
    closeModal();
    showToast('success', tToast('success.saved.title'));
  }

  function handleReactivateSuccess(updated: Therapist) {
    setTherapists((prev) => {
      if (filter === 'all') {
        return prev.map((t) => (t.id === updated.id ? updated : t));
      }
      // In 'inactive' filter: remove the now-active therapist
      return prev.filter((t) => t.id !== updated.id);
    });
    closeModal();
    showToast('success', tToast('success.saved.title'));
  }

  // ── Empty states ────────────────────────────────────────────────────────────

  const isEmpty = therapists.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  const filterTabClass = (active: boolean) =>
    [
      'px-4 py-2 rounded-lg text-sm font-medium',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
      'focus-visible:ring-offset-2',
      'motion-safe:transition-colors motion-safe:duration-150',
      active
        ? 'bg-brand-700 text-white'
        : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50',
    ].join(' ');

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
          {t('action.addTherapist')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-2" role="group" aria-label={t('filter.groupLabel')}>
          <button
            type="button"
            onClick={() => handleFilterChange('active')}
            aria-pressed={filter === 'active'}
            className={filterTabClass(filter === 'active')}
          >
            {t('filter.active')}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('inactive')}
            aria-pressed={filter === 'inactive'}
            className={filterTabClass(filter === 'inactive')}
          >
            {t('filter.deactivated')}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            aria-pressed={filter === 'all'}
            className={filterTabClass(filter === 'all')}
          >
            {t('filter.all')}
          </button>
        </div>
      </div>

      {/* List or empty state */}
      {isEmpty ? (
        <EmptyState filter={filter} onAdd={openAdd} t={t} />
      ) : (
        <ul role="list" aria-label={t('list.label')} className="divide-y-0">
          {therapists.map((therapist) => (
            <TherapistRow
              key={therapist.id}
              therapist={therapist}
              showStatus={filter === 'all' || filter === 'inactive'}
              onEdit={(th) => {
                openEdit(th);
              }}
              onDeactivate={(th) => {
                openDeactivate(th);
              }}
              onReactivate={(th) => {
                openReactivate(th);
              }}
            />
          ))}
        </ul>
      )}

      {/* Modals */}
      {modal.type === 'add' && (
        <AddTherapistModal locale={locale} onSuccess={handleAddSuccess} onClose={closeModal} />
      )}
      {modal.type === 'edit' && (
        <EditTherapistModal
          therapist={modal.therapist}
          locale={locale}
          onSuccess={handleEditSuccess}
          onClose={closeModal}
        />
      )}
      {modal.type === 'deactivate' && (
        <DeactivateTherapistDialog
          therapist={modal.therapist}
          onSuccess={handleDeactivateSuccess}
          onClose={closeModal}
        />
      )}
      {modal.type === 'reactivate' && (
        <ReactivateTherapistDialog
          therapist={modal.therapist}
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
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  filter: FilterValue;
  onAdd: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

function EmptyState({ filter, onAdd, t }: EmptyStateProps) {
  const isDeactivatedFilter = filter === 'inactive';

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {isDeactivatedFilter ? (
        <UserCheckIcon size={48} className="text-neutral-300" aria-hidden="true" />
      ) : (
        <Users size={48} className="text-neutral-300" aria-hidden="true" />
      )}

      <p className="mt-4 text-lg font-medium text-neutral-500">
        {isDeactivatedFilter ? t('empty.deactivated.title') : t('empty.active.title')}
      </p>
      <p className="mt-2 text-sm text-neutral-400">
        {isDeactivatedFilter ? t('empty.deactivated.body') : t('empty.active.body')}
      </p>

      {!isDeactivatedFilter && (
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
          {t('action.addTherapist')}
        </button>
      )}
    </div>
  );
}

// ── LoadError ─────────────────────────────────────────────────────────────────

export interface LoadErrorProps {
  onRetry: () => void;
}

export function TherapistLoadError({ onRetry }: LoadErrorProps) {
  const t = useTranslations('therapistRoster');
  const tCommon = useTranslations('common');
  return (
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
          onClick={onRetry}
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
  );
}
