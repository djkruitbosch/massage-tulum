'use client';

/**
 * TherapistForm — shared form body for Add and Edit modals.
 *
 * Used inside AddTherapistModal and EditTherapistModal.
 * react-hook-form + zod resolver using createTherapistSchema from @massage-tulum/shared.
 *
 * Fields: name (required, max 120), role (required, max 80),
 *         phone (optional), email (optional), notes (optional, max 500).
 *
 * Note on phone schema: createTherapistSchema uses optionalPhoneSchema which has a
 * .transform() making it incompatible with react-hook-form's type inference. We
 * use a local form-level schema (same constraints, no transform) and let the server
 * action handle normalization — same pattern as studio-profile-form.tsx.
 *
 * Accessibility:
 *   - Required fields: aria-required, asterisk, sr-only note.
 *   - Errors: aria-invalid + aria-describedby, role="alert" on error messages.
 *   - Focus moves to first invalid field on submit failure (onInvalid callback).
 *
 * Privacy: footer links to /aviso-de-privacidad (ES) or /en/privacy-policy (EN)
 * per the pattern established in SignupForm.
 *
 * Ref: docs/design/therapist-roster.md §5
 * Ticket: CU-869d8k3yv
 */

import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from '@massage-tulum/shared';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useRef, useState, useTransition } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { TherapistPhotoUpload } from './therapist-photo-upload';

// ── Form-level schema (no transforms) ────────────────────────────────────────

const therapistFormSchema = z.object({
  name: z.string().min(1, 'required').max(120),
  role: z.string().min(1, 'required').max(80),
  phone: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        return val.length >= 7 && val.length <= 20;
      },
      { message: 'invalid' },
    ),
  email: z
    .string()
    .email('invalid')
    .max(254)
    .nullable()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  notes: z.string().max(500, 'tooLong').nullable().optional(),
});

type FormValues = z.infer<typeof therapistFormSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TherapistFormProps {
  /** When provided: edit mode with pre-filled data */
  initialData?: Therapist | null;
  locale: string;
  onSuccess: (therapist: Therapist) => void;
  onCancel: () => void;
  onSubmit: (
    input: CreateTherapistInput | UpdateTherapistInput,
  ) => Promise<
    | { success: true; data: Therapist }
    | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  >;
  /** If provided, shows the photo upload widget above the form fields */
  therapistId?: string;
  initialPhotoUrl?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TherapistForm({
  initialData,
  locale,
  onSuccess,
  onCancel,
  onSubmit,
  therapistId,
  initialPhotoUrl,
}: TherapistFormProps) {
  const t = useTranslations('therapistRoster');
  const tCommon = useTranslations('common');
  const tToast = useTranslations('toast');
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);

  // Unique IDs for error elements
  const nameErrorId = useId();
  const roleErrorId = useId();
  const emailErrorId = useId();
  const notesCountId = useId();

  // Refs for focus management on submit error
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const roleInputRef = useRef<HTMLInputElement | null>(null);

  const isEdit = Boolean(initialData);

  const defaultValues: FormValues = {
    name: initialData?.name ?? '',
    role: initialData?.role ?? '',
    phone: initialData?.phone ?? null,
    email: initialData?.email ?? null,
    notes: initialData?.notes ?? null,
  };

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(therapistFormSchema),
    defaultValues,
  });

  const notesValue = watch('notes') ?? '';
  const notesCount = notesValue.length;

  const onFormSubmit: SubmitHandler<FormValues> = useCallback(
    (data) => {
      setServerError(null);

      const input: CreateTherapistInput | UpdateTherapistInput = {
        name: data.name,
        role: data.role,
        phone: data.phone && data.phone !== '' ? data.phone : null,
        email: data.email && data.email !== '' ? data.email : null,
        notes: data.notes && data.notes !== '' ? data.notes : null,
      };

      startTransition(async () => {
        const result = await onSubmit(input);

        if (result.success) {
          onSuccess(result.data);
        } else {
          if (result.error === 'validation' && result.fieldErrors) {
            Object.entries(result.fieldErrors).forEach(([field, msgs]) => {
              setError(field as keyof FormValues, { message: msgs[0] });
            });
          }
          setServerError(tToast('error.generic.title'));
        }
      });
    },
    [onSubmit, onSuccess, setError, tToast],
  );

  const onInvalid = useCallback(() => {
    requestAnimationFrame(() => {
      if (errors.name) {
        nameInputRef.current?.focus();
      } else if (errors.role) {
        roleInputRef.current?.focus();
      }
    });
  }, [errors.name, errors.role]);

  // Input class helper
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

  const nameRegister = register('name');
  const roleRegister = register('role');

  const privacyHref = locale === 'en' ? '/en/privacy-policy' : '/aviso-de-privacidad';

  return (
    <form onSubmit={handleSubmit(onFormSubmit, onInvalid)} noValidate>
      {/* Photo upload area — only shown in edit mode when therapistId is provided */}
      {therapistId && (
        <div className="flex flex-col items-center gap-2 pb-4 border-b border-neutral-100 mb-4">
          <TherapistPhotoUpload
            therapistId={therapistId}
            therapistName={initialData?.name ?? ''}
            photoUrl={currentPhotoUrl}
            onPhotoChange={setCurrentPhotoUrl}
          />
        </div>
      )}

      {/* Required note — screen reader only */}
      <p className="sr-only">{tCommon('form.requiredNote')}</p>

      {/* Server error banner */}
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
          <label htmlFor="therapist-field-name" className="text-sm font-medium text-neutral-700">
            {t('field.name.label')}{' '}
            <span aria-hidden="true" className="text-danger-500">
              *
            </span>
          </label>
          <input
            id="therapist-field-name"
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
              {t('field.name.error.required')}
            </p>
          )}
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1">
          <label htmlFor="therapist-field-role" className="text-sm font-medium text-neutral-700">
            {t('field.role.label')}{' '}
            <span aria-hidden="true" className="text-danger-500">
              *
            </span>
          </label>
          <input
            id="therapist-field-role"
            type="text"
            maxLength={80}
            aria-required="true"
            aria-invalid={errors.role ? 'true' : undefined}
            aria-describedby={errors.role ? roleErrorId : undefined}
            {...roleRegister}
            ref={(el) => {
              roleInputRef.current = el;
              if (typeof roleRegister.ref === 'function') roleRegister.ref(el);
            }}
            className={inputClass(Boolean(errors.role))}
          />
          {errors.role && (
            <p
              id={roleErrorId}
              role="alert"
              className="text-xs text-danger-700 flex items-center gap-1"
            >
              <AlertCircle size={12} aria-hidden="true" />
              {t('field.role.error.required')}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label htmlFor="therapist-field-phone" className="text-sm font-medium text-neutral-700">
            {t('field.phone.label')}
          </label>
          <input
            id="therapist-field-phone"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            className={inputClass(false)}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="therapist-field-email" className="text-sm font-medium text-neutral-700">
            {t('field.email.label')}
          </label>
          <input
            id="therapist-field-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? emailErrorId : undefined}
            {...register('email')}
            className={inputClass(Boolean(errors.email))}
          />
          {errors.email && (
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

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="therapist-field-notes" className="text-sm font-medium text-neutral-700">
            {t('field.notes.label')}
          </label>
          <p className="text-xs text-neutral-500">{t('field.notes.helper')}</p>
          <textarea
            id="therapist-field-notes"
            rows={3}
            maxLength={500}
            aria-describedby={notesCountId}
            {...register('notes')}
            className={[
              'w-full resize-y rounded-lg border border-neutral-200 px-3 py-2',
              'text-sm text-neutral-800 bg-white',
              'placeholder:text-neutral-400',
              'max-h-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              'focus-visible:ring-offset-2',
              'motion-safe:transition-colors motion-safe:duration-150',
              'hover:border-neutral-300',
            ].join(' ')}
          />
          <p id={notesCountId} className="text-xs text-neutral-400 text-right">
            {t('field.notes.charCount', { count: String(notesCount) })}
          </p>
        </div>
      </div>

      {/* Privacy disclosure */}
      <p className="mt-4 text-xs text-neutral-500">
        {t.rich('privacyDisclosure', {
          privacyLink: (chunks) => (
            <a
              href={privacyHref}
              className="underline hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:rounded"
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* Footer buttons */}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
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
            'motion-safe:transition-colors motion-safe:duration-150',
            'disabled:pointer-events-none disabled:opacity-80',
            'flex items-center justify-center gap-2',
            'w-full sm:w-auto',
          ].join(' ')}
        >
          {isPending
            ? tCommon('button.loading')
            : isEdit
              ? tCommon('button.save')
              : t('action.addTherapist')}
        </button>
      </div>
    </form>
  );
}
