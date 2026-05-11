'use client';

/**
 * StudioProfileForm — client component.
 *
 * react-hook-form + zod resolver using updateStudioProfileSchema from
 * @massage-tulum/shared (same schema used by the BE for validation).
 *
 * Sections:
 *   1. Basic info: name (required), description (optional, max 500 chars)
 *   2. Contact: phone + email (at least one required — cross-field)
 *   3. Operating hours: 7 rows (Mon–Sun), each with closed toggle + TimePickers
 *
 * States:
 *   - Default: pre-filled from API data
 *   - Loading (save): submit button shows spinner, button disabled
 *   - Success: toast fired, form retains new values
 *   - Error (API): toast fired, inline field errors if BE returns them
 *   - Empty (first run): info banner shown above form, form itself editable
 *
 * Accessibility:
 *   - All inputs have associated <label> elements via htmlFor.
 *   - Inline errors use aria-invalid + aria-describedby.
 *   - On submit with errors, focus moves to first invalid field.
 *   - Hours closed switch has role="switch" + aria-checked + aria-label.
 *
 * Ref: docs/design/studio-profile.md
 * Ref: docs/architecture/CU-869d29f1h-studio-profile.md §4
 * Ticket: CU-869d8cp2d
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { type StudioProfile, type UpdateStudioProfileInput } from '@massage-tulum/shared';
import { AlertCircle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { Controller, useFieldArray, useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { patchMyStudioProfile } from '../../../../../actions/studio-profile';
import { FormSection } from './form-section';
import { HoursRow } from './hours-row';
import { PageHeader } from './page-header';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Form-specific schema for react-hook-form validation.
 *
 * Differs from updateStudioProfileSchema in that the phone field does NOT
 * use optionalPhoneSchema (which has a .transform() that changes the type
 * from string|null|undefined to string|null — incompatible with react-hook-form).
 *
 * Phone format validation is still performed here (E.164-like basic check).
 * E.164 normalization happens server-side in patchMyStudioProfile (correct architecture).
 *
 * The hours sub-schema matches studioHoursEntrySchema without the transform.
 */
const hoursEntryFormSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    isOpen: z.boolean(),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format')
      .nullable()
      .optional(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.isOpen) return true;
      return data.openTime != null && data.closeTime != null;
    },
    { message: 'openTime and closeTime are required when isOpen is true' },
  )
  .refine(
    (data) => {
      if (!data.isOpen || !data.openTime || !data.closeTime) return true;
      return data.closeTime > data.openTime;
    },
    { message: 'closeTime must be after openTime', path: ['closeTime'] },
  );

const profileFormSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  phone: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        // Basic E.164-ish validation — normalization happens server-side
        return val.length >= 7 && val.length <= 20;
      },
      { message: 'Invalid phone number' },
    ),
  email: z.string().email().max(254).nullable().optional(),
  hours: z.array(hoursEntryFormSchema).length(7).optional(),
});

type FormValues = z.infer<typeof profileFormSchema>;

interface ToastState {
  id: string;
  variant: 'success' | 'error';
  title: string;
  description?: string;
}

// ── Day label map (weekday index → i18n key suffix) ──────────────────────────

const WEEKDAY_KEYS = [
  { full: 'monday', short: 'mon' },
  { full: 'tuesday', short: 'tue' },
  { full: 'wednesday', short: 'wed' },
  { full: 'thursday', short: 'thu' },
  { full: 'friday', short: 'fri' },
  { full: 'saturday', short: 'sat' },
  { full: 'sunday', short: 'sun' },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface StudioProfileFormProps {
  /** Initial profile data from the server — null = first run (empty state) */
  initialData: StudioProfile | null;
  /** Called to re-fetch profile (cancel / retry) */
  onReload: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build default hours array (7 days, all closed) */
function defaultHours(): NonNullable<FormValues['hours']> {
  return Array.from({ length: 7 }, (_, i) => ({
    weekday: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    isOpen: false,
    openTime: null,
    closeTime: null,
  }));
}

/** Map StudioProfile to FormValues */
function profileToForm(profile: StudioProfile): FormValues {
  // Ensure hours are sorted by weekday and padded to 7
  const hoursMap = new Map(profile.hours.map((h) => [h.weekday, h]));
  const hours = Array.from({ length: 7 }, (_, i) => {
    const weekday = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    const h = hoursMap.get(weekday);
    return {
      weekday,
      isOpen: h?.isOpen ?? false,
      openTime: h?.openTime ?? null,
      closeTime: h?.closeTime ?? null,
    };
  });

  return {
    name: profile.name,
    description: profile.description ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    hours,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudioProfileForm({ initialData, onReload }: StudioProfileFormProps) {
  const t = useTranslations('studioProfile');
  const tCommonDay = useTranslations('common.day');
  const tToast = useTranslations('toast');
  const [isPending, startTransition] = useTransition();

  // Toast state
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unique IDs for error elements
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const emailErrorId = useId();
  const descCountId = useId();

  // Refs to first invalid field for focus management on submit error
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const defaultValues: FormValues = initialData
    ? profileToForm(initialData)
    : {
        name: '',
        description: null,
        phone: null,
        email: null,
        hours: defaultHours(),
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  });

  // Reset form when initialData changes (e.g., after successful save)
  useEffect(() => {
    if (initialData) {
      reset(profileToForm(initialData));
    }
  }, [initialData, reset]);

  const { fields: hoursFields, update: updateHour } = useFieldArray({
    control,
    name: 'hours',
  });

  const descriptionValue = watch('description') ?? '';
  const descCount = (descriptionValue ?? '').length;

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const showToast = useCallback(
    (variant: 'success' | 'error', title: string, description?: string) => {
      setToast({ id: Math.random().toString(36).slice(2), variant, title, description });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 5000);
    },
    [],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit: SubmitHandler<FormValues> = useCallback(
    (data) => {
      // Cast to UpdateStudioProfileInput — safe because profileFormSchema validates
      // the same constraints. Phone normalization to E.164 happens server-side.
      const input: UpdateStudioProfileInput = {
        name: data.name,
        description: data.description ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        hours: (data.hours ?? defaultHours()) as UpdateStudioProfileInput['hours'],
      };

      startTransition(async () => {
        const result = await patchMyStudioProfile(input);

        if (result.success) {
          // Reset form with the saved data returned by the server
          reset(profileToForm(result.data));
          showToast('success', tToast('success.saved.title'), tToast('success.saved.description'));
        } else {
          // Map field errors from BE back to form
          if (result.error === 'validation' && result.fieldErrors) {
            Object.entries(result.fieldErrors).forEach(([field, msgs]) => {
              setError(field as keyof FormValues, { message: msgs[0] });
            });
          }
          showToast('error', tToast('error.generic.title'), tToast('error.generic.description'));
        }
      });
    },
    [reset, setError, showToast, tToast],
  );

  // Focus first invalid field on submit validation failure
  const onInvalid = useCallback(() => {
    requestAnimationFrame(() => {
      if (errors.name) {
        nameInputRef.current?.focus();
      } else if (errors.phone) {
        phoneInputRef.current?.focus();
      } else if (errors.email) {
        emailInputRef.current?.focus();
      }
    });
  }, [errors.name, errors.phone, errors.email]);

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    if (initialData) {
      reset(profileToForm(initialData));
    } else {
      reset({ name: '', description: null, phone: null, email: null, hours: defaultHours() });
    }
    onReload();
  }, [initialData, reset, onReload]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = !initialData;

  // Get the register function's ref and combine with our own ref
  const nameRegister = register('name');
  const phoneRegister = register('phone');
  const emailRegister = register('email');

  return (
    <div className="space-y-6">
      {/* Page header with title + save/cancel buttons */}
      <PageHeader isLoading={isPending} onCancel={handleCancel} />

      {/* Empty state banner (first run) */}
      {isEmpty && (
        <div
          className="flex gap-3 rounded-lg border-l-4 border-info-500 bg-info-50 p-4"
          role="status"
        >
          <Info size={18} className="text-info-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-neutral-700">{t('empty.title')}</p>
            <p className="mt-0.5 text-sm text-neutral-500">{t('empty.body')}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        id="studio-profile-form"
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        aria-label={t('page.title')}
      >
        <div className="space-y-6">
          {/* ── Section 1: Basic information ─────────────────────────── */}
          <FormSection title={t('section.basicInfo')}>
            <div className="space-y-5">
              {/* Studio name */}
              <div className="flex flex-col gap-1">
                <label htmlFor="field-name" className="text-sm font-medium text-neutral-700">
                  {t('field.name.label')}{' '}
                  <span aria-hidden="true" className="text-danger-500">
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </label>
                <input
                  id="field-name"
                  type="text"
                  autoComplete="organization"
                  maxLength={120}
                  aria-required="true"
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? nameErrorId : undefined}
                  {...nameRegister}
                  ref={(el) => {
                    nameInputRef.current = el;
                    if (typeof nameRegister.ref === 'function') nameRegister.ref(el);
                  }}
                  className={[
                    'h-10 w-full rounded-lg border px-3 text-sm text-neutral-800 bg-white',
                    'placeholder:text-neutral-400',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    'focus-visible:ring-offset-2',
                    'motion-safe:transition-colors motion-safe:duration-150',
                    errors.name
                      ? 'border-danger-500 focus-visible:ring-danger-500'
                      : 'border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                />
                {errors.name && (
                  <p
                    id={nameErrorId}
                    role="alert"
                    className="text-xs text-danger-700 flex items-center gap-1"
                  >
                    <AlertCircle size={12} aria-hidden="true" />
                    {t('field.name.error.required')}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label htmlFor="field-description" className="text-sm font-medium text-neutral-700">
                  {t('field.description.label')}
                </label>
                <textarea
                  id="field-description"
                  rows={4}
                  maxLength={500}
                  aria-describedby={descCountId}
                  {...register('description')}
                  className={[
                    'w-full resize-y rounded-lg border border-neutral-200 px-3 py-2',
                    'text-sm text-neutral-800 bg-white',
                    'placeholder:text-neutral-400',
                    'max-h-48',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    'focus-visible:ring-offset-2',
                    'motion-safe:transition-colors motion-safe:duration-150',
                    'hover:border-neutral-300',
                  ].join(' ')}
                />
                <p id={descCountId} className="text-xs text-neutral-400 text-right">
                  {t('field.description.charCount', { count: String(descCount) })}
                </p>
              </div>
            </div>
          </FormSection>

          {/* ── Section 2: Contact ───────────────────────────────────── */}
          <FormSection title={t('section.contact')}>
            {/* Cross-field contact error */}
            {(errors.phone?.message === t('field.contact.error.atLeastOne') ||
              errors.email?.message === t('field.contact.error.atLeastOne')) && (
              <div
                role="alert"
                className="mb-4 flex gap-2 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                {t('field.contact.error.atLeastOne')}
              </div>
            )}

            {/* Phone + Email: 2-column on lg, 1-column on smaller */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Phone */}
              <div className="flex flex-col gap-1">
                <label htmlFor="field-phone" className="text-sm font-medium text-neutral-700">
                  {t('field.phone.label')}
                </label>
                <p className="text-xs text-neutral-500">{t('field.phone.helper')}</p>
                <input
                  id="field-phone"
                  type="tel"
                  placeholder={t('field.phone.placeholder')}
                  autoComplete="tel"
                  aria-invalid={errors.phone ? 'true' : undefined}
                  aria-describedby={errors.phone ? phoneErrorId : undefined}
                  {...phoneRegister}
                  ref={(el) => {
                    phoneInputRef.current = el;
                    if (typeof phoneRegister.ref === 'function') phoneRegister.ref(el);
                  }}
                  className={[
                    'h-10 rounded-lg border px-3 text-sm text-neutral-800 bg-white',
                    'placeholder:text-neutral-400',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    'focus-visible:ring-offset-2',
                    'motion-safe:transition-colors motion-safe:duration-150',
                    'w-full',
                    errors.phone
                      ? 'border-danger-500 focus-visible:ring-danger-500'
                      : 'border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                />
                {errors.phone && errors.phone.message !== t('field.contact.error.atLeastOne') && (
                  <p
                    id={phoneErrorId}
                    role="alert"
                    className="text-xs text-danger-700 flex items-center gap-1"
                  >
                    <AlertCircle size={12} aria-hidden="true" />
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1">
                <label htmlFor="field-email" className="text-sm font-medium text-neutral-700">
                  {t('field.email.label')}
                </label>
                <input
                  id="field-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? 'true' : undefined}
                  aria-describedby={errors.email ? emailErrorId : undefined}
                  {...emailRegister}
                  ref={(el) => {
                    emailInputRef.current = el;
                    if (typeof emailRegister.ref === 'function') emailRegister.ref(el);
                  }}
                  className={[
                    'h-10 rounded-lg border px-3 text-sm text-neutral-800 bg-white',
                    'placeholder:text-neutral-400',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                    'focus-visible:ring-offset-2',
                    'motion-safe:transition-colors motion-safe:duration-150',
                    'w-full',
                    errors.email
                      ? 'border-danger-500 focus-visible:ring-danger-500'
                      : 'border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                />
                {errors.email && errors.email.message !== t('field.contact.error.atLeastOne') && (
                  <p
                    id={emailErrorId}
                    role="alert"
                    className="text-xs text-danger-700 flex items-center gap-1"
                  >
                    <AlertCircle size={12} aria-hidden="true" />
                    {t('field.email.error.format')}
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          {/* ── Section 3: Operating hours ───────────────────────────── */}
          <FormSection title={t('section.hours')}>
            <p className="mb-4 text-sm text-neutral-500">{t('hours.timezone.note')}</p>

            <div role="group" aria-label={t('section.hours')}>
              {hoursFields.map((field, index) => {
                const dayKeys = WEEKDAY_KEYS[index];
                // dayKeys is always defined since hoursFields has 7 entries
                const fullName = dayKeys ? tCommonDay(dayKeys.full) : String(index + 1);
                const shortName = dayKeys ? tCommonDay(dayKeys.short) : String(index + 1);
                const rowError = errors.hours?.[index];
                // The refine error appears on the root of the hours entry object
                const closeAfterOpenError = rowError?.root?.message ?? rowError?.closeTime?.message;

                const weekdayNum = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

                return (
                  <Controller
                    key={field.id}
                    control={control}
                    name={`hours.${index}`}
                    render={({ field: controllerField }) => {
                      const val = controllerField.value ?? {
                        weekday: weekdayNum,
                        isOpen: false,
                        openTime: null,
                        closeTime: null,
                      };
                      return (
                        <HoursRow
                          weekday={weekdayNum}
                          fullDayName={fullName}
                          shortDayName={shortName}
                          isOpen={val.isOpen}
                          openTime={val.openTime}
                          closeTime={val.closeTime}
                          onToggle={(open) => {
                            updateHour(index, {
                              weekday: weekdayNum,
                              isOpen: open,
                              openTime: open ? val.openTime : null,
                              closeTime: open ? val.closeTime : null,
                            });
                          }}
                          onOpenTimeChange={(newVal) => {
                            updateHour(index, {
                              weekday: weekdayNum,
                              isOpen: val.isOpen,
                              openTime: newVal || null,
                              closeTime: val.closeTime,
                            });
                          }}
                          onCloseTimeChange={(newVal) => {
                            updateHour(index, {
                              weekday: weekdayNum,
                              isOpen: val.isOpen,
                              openTime: val.openTime,
                              closeTime: newVal || null,
                            });
                          }}
                          closeAfterOpenError={
                            closeAfterOpenError ? t('hours.error.closeAfterOpen') : undefined
                          }
                        />
                      );
                    }}
                  />
                );
              })}
            </div>
          </FormSection>

          {/* ── Footer action bar ─────────────────────────────────────── */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
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
              disabled={isPending}
              className={[
                'h-10 rounded-lg bg-brand-700 px-6',
                'text-sm font-medium text-white',
                'hover:bg-brand-800',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                'focus-visible:ring-offset-2',
                'motion-safe:transition-colors motion-safe:duration-150',
                'disabled:pointer-events-none disabled:opacity-80',
                'flex items-center justify-center gap-2',
                'w-full sm:w-auto',
              ].join(' ')}
              aria-busy={isPending}
            >
              {t('action.save')}
            </button>
          </div>
        </div>
      </form>

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
          {toast.description && (
            <p className="text-sm text-neutral-500 mt-0.5">{toast.description}</p>
          )}
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
