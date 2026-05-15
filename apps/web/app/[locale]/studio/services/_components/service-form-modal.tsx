'use client';

/**
 * ServiceFormModal — Add and Edit modal for services.
 *
 * Both Add and Edit modes use this single component. Mode is determined by
 * whether `initialData` is provided.
 *
 * Form fields:
 *   - name (required, max 120)
 *   - category (optional, CategoryCombobox)
 *   - description (optional, textarea, max 1000)
 *   - durationMinutes (required, DurationPicker)
 *   - basePriceMxn (required, number input, min 0)
 *
 * Uses react-hook-form with zod resolver.
 * Schemas imported from @massage-tulum/shared (createServiceSchema / updateServiceSchema).
 *
 * Default duration on Add: 60 min.
 *
 * Accessibility:
 *   - role="dialog" + aria-labelledby + aria-modal="true"
 *   - Focus trap (Tab cycles within modal)
 *   - Escape key closes without saving
 *   - Focus moves to Name field on open
 *   - Error messages use aria-invalid + aria-describedby
 *
 * Ref: docs/design/service-catalog.md §5
 * Ticket: CU-869d29f21
 */

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  CreateServiceInput,
  ServiceResponse,
  UpdateServiceInput,
} from '@massage-tulum/shared';
import { AlertCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { createService, updateService } from '../../../../../actions/services';
import { CategoryCombobox } from './category-combobox';
import { DurationPicker } from './duration-picker';

// ── Form schema — mirrors createServiceSchema but with max 480 on duration ─────

const serviceFormSchema = z.object({
  name: z.string().min(1, 'nameRequired').max(120, 'nameTooLong'),
  category: z.string().max(60, 'categoryTooLong').nullable().optional(),
  description: z.string().max(1000, 'descriptionTooLong').nullable().optional(),
  durationMinutes: z
    .number({ invalid_type_error: 'durationInvalid' })
    .int('durationInvalid')
    .min(1, 'durationMin')
    .max(480, 'durationMax'),
  basePriceMxn: z
    .number({ invalid_type_error: 'priceRequired' })
    .int('priceRequired')
    .min(0, 'priceNegative'),
});

type FormValues = z.infer<typeof serviceFormSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ServiceFormModalProps {
  initialData?: ServiceResponse | null;
  locale: string;
  onSuccess: (service: ServiceResponse) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ServiceFormModal({
  initialData,
  locale: _locale,
  onSuccess,
  onClose,
}: ServiceFormModalProps) {
  const t = useTranslations('serviceCatalog');
  const tCommon = useTranslations('common');

  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const isEdit = Boolean(initialData);

  const titleId = useId();
  const nameErrorId = useId();
  const descErrorId = useId();
  const priceErrorId = useId();
  const durationErrorId = useId();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Resolve error key to translated message
  function resolveError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    const map: Record<string, string> = {
      nameRequired: t('field.name.error.required'),
      nameTooLong: t('field.name.error.tooLong'),
      categoryTooLong: t('field.category.error.tooLong'),
      descriptionTooLong: t('field.description.error.tooLong'),
      durationRequired: t('field.duration.error.required'),
      durationInvalid: t('field.duration.error.min'),
      durationMin: t('field.duration.error.min'),
      durationMax: t('field.duration.error.max'),
      priceRequired: t('field.price.error.required'),
      priceNegative: t('field.price.error.min'),
    };
    return map[key] ?? key;
  }

  const defaultValues: Partial<FormValues> = {
    name: initialData?.name ?? '',
    category: initialData?.category ?? null,
    description: initialData?.description ?? null,
    durationMinutes: initialData?.durationMinutes ?? 60,
    // Leave basePriceMxn undefined on add so the user must explicitly enter it;
    // on edit, pre-fill with the existing value.
    basePriceMxn: initialData?.basePriceMxn,
  };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues,
  });

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap + initial focus on Name input
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Initial focus on name field
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    dialog.addEventListener('keydown', trapFocus);
    return () => dialog.removeEventListener('keydown', trapFocus);
  }, []);

  const onFormSubmit = useCallback(
    (data: FormValues) => {
      setServerError(null);

      const normalizedCategory =
        !data.category || data.category.trim() === '' ? null : data.category.trim();

      startTransition(async () => {
        let result;

        if (isEdit && initialData) {
          const input: UpdateServiceInput = {
            name: data.name,
            category: normalizedCategory,
            description: data.description ?? null,
            durationMinutes: data.durationMinutes,
            basePriceMxn: data.basePriceMxn,
          };
          result = await updateService(initialData.id, input);
        } else {
          const input: CreateServiceInput = {
            name: data.name,
            category: normalizedCategory,
            description: data.description ?? null,
            durationMinutes: data.durationMinutes,
            basePriceMxn: data.basePriceMxn,
          };
          result = await createService(input);
        }

        if (result.success) {
          onSuccess(result.data);
        } else {
          if (result.error === 'validation' && result.fieldErrors) {
            Object.entries(result.fieldErrors).forEach(([field, msgs]) => {
              setError(field as keyof FormValues, { message: msgs[0] });
            });
          }
          setServerError(tCommon('error.title'));
        }
      });
    },
    [isEdit, initialData, onSuccess, setError, tCommon],
  );

  const nameRegister = register('name');
  const priceRegister = register('basePriceMxn', { valueAsNumber: true });

  const inputClass = (hasError: boolean) =>
    [
      'h-10 w-full rounded-lg border px-3 text-sm text-neutral-800 bg-white',
      'placeholder:text-neutral-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
      'focus-visible:ring-offset-2',
      'motion-safe:transition-colors motion-safe:duration-150',
      hasError
        ? 'border-danger-500 focus-visible:ring-danger-500'
        : 'border-neutral-200 hover:border-neutral-300',
    ].join(' ');

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[190] bg-black/40" aria-hidden="true" onClick={onClose} />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          'fixed z-[200] w-full max-w-lg',
          'top-[10vh] left-1/2 -translate-x-1/2',
          'inset-x-4 sm:inset-x-auto',
          'bg-white rounded-lg shadow-lg',
          'overflow-y-auto max-h-[80vh]',
        ].join(' ')}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-6 pt-5 pb-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('button.close')}
            className={[
              'absolute right-4 top-4 rounded p-1 text-neutral-400',
              'hover:text-neutral-600 hover:bg-neutral-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            ].join(' ')}
          >
            <X size={18} aria-hidden="true" />
          </button>

          <h3 id={titleId} className="text-base font-semibold text-neutral-800 pr-8">
            {isEdit ? t('modal.edit.title') : t('modal.add.title')}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onFormSubmit)} noValidate className="px-6 py-4">
          {/* Required fields note */}
          <p className="sr-only">{tCommon('form.requiredNote')}</p>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="mb-4 flex gap-2 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              {serverError}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`${titleId}-name`} className="text-sm font-medium text-neutral-700">
                {t('field.name.label')}{' '}
                <span aria-hidden="true" className="text-danger-500">
                  *
                </span>
              </label>
              <input
                id={`${titleId}-name`}
                type="text"
                maxLength={120}
                aria-required="true"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? nameErrorId : undefined}
                {...nameRegister}
                ref={(el) => {
                  nameInputRef.current = el;
                  if (typeof nameRegister.ref === 'function') nameRegister.ref(el);
                }}
                className={inputClass(Boolean(errors.name))}
              />
              {errors.name && (
                <p
                  id={nameErrorId}
                  role="alert"
                  className="text-xs text-danger-700 flex items-center gap-1"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  {resolveError(errors.name.message)}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">
                {t('field.category.label')}
              </label>
              <p className="text-xs text-neutral-500">{t('field.category.helper')}</p>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CategoryCombobox value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${titleId}-description`}
                className="text-sm font-medium text-neutral-700"
              >
                {t('field.description.label')}
              </label>
              <textarea
                id={`${titleId}-description`}
                rows={3}
                maxLength={1000}
                aria-invalid={errors.description ? 'true' : undefined}
                aria-describedby={errors.description ? descErrorId : undefined}
                {...register('description')}
                className={[
                  'w-full resize-y rounded-lg border px-3 py-2',
                  'text-sm text-neutral-800 bg-white',
                  'placeholder:text-neutral-400',
                  'max-h-40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  'focus-visible:ring-offset-2',
                  'motion-safe:transition-colors motion-safe:duration-150',
                  errors.description
                    ? 'border-danger-500'
                    : 'border-neutral-200 hover:border-neutral-300',
                ].join(' ')}
              />
              {errors.description && (
                <p id={descErrorId} role="alert" className="text-xs text-danger-700">
                  {resolveError(errors.description.message)}
                </p>
              )}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">
                {t('field.duration.label')}{' '}
                <span aria-hidden="true" className="text-danger-500">
                  *
                </span>
              </label>
              <Controller
                name="durationMinutes"
                control={control}
                render={({ field }) => (
                  <DurationPicker
                    value={field.value}
                    onChange={(minutes) => {
                      // Pass NaN when null so zod min(1) catches it
                      field.onChange(minutes ?? NaN);
                    }}
                    error={
                      errors.durationMinutes
                        ? resolveError(errors.durationMinutes.message)
                        : undefined
                    }
                  />
                )}
              />
              {/* Hidden describedby error anchor for screen readers */}
              {errors.durationMinutes && (
                <span id={durationErrorId} className="sr-only">
                  {resolveError(errors.durationMinutes.message)}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`${titleId}-price`} className="text-sm font-medium text-neutral-700">
                {t('field.price.label')}{' '}
                <span aria-hidden="true" className="text-danger-500">
                  *
                </span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm text-neutral-500 pointer-events-none select-none">
                  MXN $
                </span>
                <input
                  id={`${titleId}-price`}
                  type="number"
                  min="0"
                  step="1"
                  aria-required="true"
                  aria-invalid={errors.basePriceMxn ? 'true' : undefined}
                  aria-describedby={errors.basePriceMxn ? priceErrorId : `${titleId}-price-helper`}
                  {...priceRegister}
                  className={[inputClass(Boolean(errors.basePriceMxn)), 'pl-16'].join(' ')}
                />
              </div>
              <p id={`${titleId}-price-helper`} className="text-xs text-neutral-500">
                {t('field.price.helper')}
              </p>
              {errors.basePriceMxn && (
                <p
                  id={priceErrorId}
                  role="alert"
                  className="text-xs text-danger-700 flex items-center gap-1"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  {resolveError(errors.basePriceMxn.message)}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className={[
                'h-10 rounded-lg border border-neutral-200 bg-white px-4',
                'text-sm font-medium text-neutral-700',
                'hover:bg-neutral-50 hover:border-neutral-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                'w-full sm:w-auto',
              ].join(' ')}
            >
              {tCommon('button.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className={[
                'h-10 rounded-lg bg-brand-700 px-6',
                'text-sm font-medium text-white',
                'hover:bg-brand-800',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-80',
                'flex items-center justify-center gap-2',
                'w-full sm:w-auto',
              ].join(' ')}
            >
              {isPending ? tCommon('button.loading') : tCommon('button.save')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
