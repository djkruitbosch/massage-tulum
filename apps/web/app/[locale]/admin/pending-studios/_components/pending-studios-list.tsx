'use client';

/**
 * PendingStudiosList — client component.
 *
 * Orchestrates the pending studios table (desktop) and card list (mobile).
 * Owns the approve/reject modal state and row-level loading states.
 * Fires the approve/reject server actions and manages toast notifications.
 *
 * Desktop: semantic <table> with proper thead/tbody/th[scope="col"] structure.
 * Mobile (<768px): stacked card list via PendingStudioCard — the <table> is
 * NOT rendered on mobile to avoid accessibility issues with narrow tables.
 *
 * Row removal: on successful action, the row is removed from local state
 * (optimistic UI — the row is gone immediately, consistent with spec §Screen 5).
 *
 * Toast: lightweight inline toast implementation using aria-live="polite".
 * A full Toast system is available via app-level toast; for simplicity in this
 * admin-only screen we use an inline notification banner.
 *
 * Ref: docs/design/components/PendingStudiosTable.md
 * Ticket: CU-869d4za07
 */

import { ClipboardCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { approvePendingStudio, rejectPendingStudio } from '../../../../../actions/admin';
import { ApproveButton } from './approve-button';
import { RejectModal } from './reject-modal';
import { PendingStudioCard } from './pending-studio-card';

interface PendingStudio {
  id: string;
  email: string;
  studioName: string;
  contactPhone: string | null;
  description: string;
  locale: string;
  status: string;
  submittedAt: string;
}

interface PendingStudiosListProps {
  initialApplications: PendingStudio[];
  locale: string;
}

type ToastState = {
  message: string;
  variant: 'success' | 'error';
} | null;

type RowAction = {
  id: string;
  action: 'approve' | 'reject';
} | null;

export function PendingStudiosList({ initialApplications, locale }: PendingStudiosListProps) {
  const t = useTranslations('admin.pendingStudios');
  const [applications, setApplications] = useState<PendingStudio[]>(initialApplications);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingAction, startTransition] = useTransition();

  // Track which row is being acted upon and what action
  const [rowAction, setRowAction] = useState<RowAction>(null);

  // Reject modal state: holds the application id+name being rejected
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    studioName: string;
  } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    // Auto-dismiss success toasts after 5s; error toasts persist until dismissed
    if (variant === 'success') {
      toastTimerRef.current = setTimeout(() => setToast(null), 5000);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleApproveConfirm = (applicationId: string) => {
    setRowAction({ id: applicationId, action: 'approve' });
    startTransition(async () => {
      const result = await approvePendingStudio(applicationId);
      setRowAction(null);

      if (result.success) {
        // Remove row from local state
        setApplications((prev) => prev.filter((a) => a.id !== applicationId));
        showToast(t('toast.approveSuccess'), 'success');
      } else {
        showToast(t('toast.approveError'), 'error');
      }
    });
  };

  const handleRejectClick = (applicationId: string, studioName: string) => {
    setRejectTarget({ id: applicationId, studioName });
  };

  const handleRejectConfirm = (reason: string | null) => {
    if (!rejectTarget) return;
    const { id: applicationId } = rejectTarget;
    setRejectTarget(null);
    setRowAction({ id: applicationId, action: 'reject' });

    startTransition(async () => {
      const result = await rejectPendingStudio(applicationId, reason);
      setRowAction(null);

      if (result.success) {
        setApplications((prev) => prev.filter((a) => a.id !== applicationId));
        showToast(t('toast.rejectSuccess'), 'success');
      } else {
        showToast(t('toast.rejectError'), 'error');
      }
    });
  };

  const handleRejectCancel = () => {
    setRejectTarget(null);
  };

  // Utility: format date per locale
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(iso));

  // ── Toast notification ────────────────────────���───────────────────────────
  const ToastBanner = toast ? (
    <div
      aria-live="polite"
      role="status"
      className={[
        'fixed bottom-4 right-4 z-[80]',
        'max-w-sm rounded-2xl shadow-lg px-4 py-3',
        'flex items-center justify-between gap-4',
        'text-sm font-medium',
        toast.variant === 'success'
          ? 'bg-success-50 border border-success-500 text-success-700'
          : 'bg-danger-50 border border-danger-500 text-danger-700',
      ].join(' ')}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => setToast(null)}
        aria-label="Close notification"
        className="shrink-0 text-current opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
      >
        &times;
      </button>
    </div>
  ) : null;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (applications.length === 0) {
    return (
      <>
        {ToastBanner}
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ClipboardCheck size={48} className="text-neutral-300 mx-auto" aria-hidden="true" />
          <p className="text-base text-neutral-500 mt-4">{t('empty')}</p>
        </div>
      </>
    );
  }

  // ── Mobile card list (<768px) + Desktop table (≥768px) ────────────────────
  return (
    <>
      {ToastBanner}

      {/* Mobile card list — hidden on md and above */}
      <div className="md:hidden space-y-0">
        {applications.map((app) => (
          <PendingStudioCard
            key={app.id}
            id={app.id}
            submittedAt={app.submittedAt}
            email={app.email}
            studioName={app.studioName}
            contactPhone={app.contactPhone}
            description={app.description}
            locale={locale}
            loadingAction={
              rowAction?.id === app.id ? (rowAction.action as 'approve' | 'reject') : null
            }
            onApprove={handleApproveConfirm}
            onReject={handleRejectClick}
          />
        ))}
      </div>

      {/* Desktop table — hidden on mobile */}
      <div
        className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden"
        aria-busy={pendingAction ? 'true' : undefined}
      >
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th
                scope="col"
                className="w-24 px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500"
              >
                {t('columns.submittedAt')}
              </th>
              <th
                scope="col"
                className="min-w-[180px] max-w-[220px] px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500"
              >
                {t('columns.email')}
              </th>
              <th
                scope="col"
                className="min-w-[140px] max-w-[200px] px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500"
              >
                {t('columns.studioName')}
              </th>
              <th
                scope="col"
                className="w-32 px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500 hidden lg:table-cell"
              >
                {t('columns.contactPhone')}
              </th>
              <th
                scope="col"
                className="w-[160px] px-4 py-3 text-right text-xs font-medium uppercase text-neutral-500 sr-only"
              >
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const isApprovingRow = rowAction?.id === app.id && rowAction.action === 'approve';
              const isRejectingRow = rowAction?.id === app.id && rowAction.action === 'reject';
              const descId = `desc-${app.id}`;

              return (
                <DescriptionExpandableRow
                  key={app.id}
                  app={app}
                  descId={descId}
                  formatDate={formatDate}
                  isApprovingRow={isApprovingRow}
                  isRejectingRow={isRejectingRow}
                  onApproveConfirm={handleApproveConfirm}
                  onRejectClick={handleRejectClick}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reject modal — rendered outside the table */}
      {rejectTarget && (
        <RejectModal onConfirm={handleRejectConfirm} onCancel={handleRejectCancel} />
      )}
    </>
  );
}

// ── Desktop table row sub-component ──────────────────────────────────────────

interface DescriptionExpandableRowProps {
  app: PendingStudio;
  descId: string;
  formatDate: (iso: string) => string;
  isApprovingRow: boolean;
  isRejectingRow: boolean;
  onApproveConfirm: (id: string) => void;
  onRejectClick: (id: string, studioName: string) => void;
}

function DescriptionExpandableRow({
  app,
  descId,
  formatDate,
  isApprovingRow,
  isRejectingRow,
  onApproveConfirm,
  onRejectClick,
}: DescriptionExpandableRowProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const tAdmin = useTranslations('admin.pendingStudios');

  const isAnyActionInFlight = isApprovingRow || isRejectingRow;

  return (
    <>
      {/* Main data row */}
      <tr className="border-b border-neutral-100 motion-safe:transition-colors motion-safe:duration-100 hover:bg-brand-50">
        <td className="w-24 px-4 py-4 text-sm text-neutral-500 align-top" title={app.submittedAt}>
          {formatDate(app.submittedAt)}
        </td>
        <td className="min-w-[180px] max-w-[220px] px-4 py-4 align-top">
          <span className="block text-sm text-neutral-600 truncate max-w-[200px]" title={app.email}>
            {app.email}
          </span>
        </td>
        <td className="min-w-[140px] max-w-[200px] px-4 py-4 align-top">
          <span
            className="block text-sm font-medium text-neutral-700 truncate max-w-[180px]"
            title={app.studioName}
          >
            {app.studioName}
          </span>
        </td>
        <td
          className="w-32 px-4 py-4 align-top hidden lg:table-cell"
          aria-label={app.contactPhone ? undefined : tAdmin('columns.noPhone')}
        >
          <span className="text-sm text-neutral-500">
            {app.contactPhone ?? <span aria-hidden="true">—</span>}
          </span>
        </td>
        <td className="w-[160px] px-4 py-4 align-top">
          <div className="flex gap-2 justify-end">
            <ApproveButton
              applicationId={app.id}
              studioName={app.studioName}
              onConfirm={onApproveConfirm}
              isLoading={isApprovingRow}
              otherActionLoading={isRejectingRow}
            />
            <button
              type="button"
              onClick={() => onRejectClick(app.id, app.studioName)}
              disabled={isAnyActionInFlight}
              aria-label={tAdmin('actions.rejectLabel', { studioName: app.studioName })}
              className={[
                'h-8 rounded-lg border border-neutral-200 bg-white px-3',
                'text-xs font-medium text-neutral-700',
                'hover:bg-neutral-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2',
                'motion-safe:transition-colors motion-safe:duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isRejectingRow ? 'opacity-50 cursor-not-allowed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {tAdmin('actions.reject')}
            </button>
          </div>
        </td>
      </tr>

      {/* Description sub-row (full-width) */}
      {app.description && (
        <tr className="border-b border-neutral-100">
          <td colSpan={5} className="px-4 pb-3">
            <p
              id={descId}
              className={['text-sm text-neutral-500', descriptionExpanded ? '' : 'line-clamp-2']
                .filter(Boolean)
                .join(' ')}
            >
              {app.description}
            </p>
            <button
              type="button"
              aria-expanded={descriptionExpanded}
              aria-controls={descId}
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              className={[
                'text-xs text-brand-600 mt-1',
                'hover:underline underline-offset-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2 rounded',
              ].join(' ')}
            >
              {descriptionExpanded
                ? tAdmin('description.showLess')
                : tAdmin('description.showMore')}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
