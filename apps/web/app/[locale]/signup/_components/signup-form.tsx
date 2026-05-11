'use client';

/**
 * SignupForm — client component.
 *
 * Multi-field studio registration form. State machine: idle → loading → success | error
 *
 * Validation runs on submit only (not on blur, not as user types) per spec AC-3
 * and SignupForm.md. Focus moves to the first invalid field on submit-with-errors.
 *
 * Uses react-hook-form + zod resolver with the shared schema from
 * packages/shared so client-side and server-side validation rules stay in sync.
 *
 * Hidden locale field: the current locale (derived from the URL prefix via prop)
 * is included in the POST body per GATE 2 amendment so the welcome email can be
 * sent in the studio owner's preferred language.
 *
 * On success: replaces form content with a confirmation card. No redirect.
 * On error: shows a form-level error banner; focus moves to the banner.
 *
 * Ref: docs/design/components/SignupForm.md
 * Ticket: CU-869d4za07
 */

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { submitSignup } from '../../../../actions/signup';

// Client-side validation schema — mirrors the shared backend schema with
// human-readable error codes. The shared schema is used on the server action.
// We define a local schema here to give fine-grained per-field error keys.
const signupFormSchema = z.object({
  email: z.string().min(1, 'emailRequired').max(254, 'emailInvalid').email('emailInvalid'),
  studioName: z.string().min(1, 'studioNameRequired').max(100, 'studioNameTooLong'),
  contactPhone: z.string().max(20).optional(),
  description: z.string().min(1, 'descriptionRequired').max(1000, 'descriptionTooLong'),
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

interface SignupFormProps {
  locale: string;
}

export function SignupForm({ locale }: SignupFormProps) {
  const t = useTranslations('auth.signup');
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const studioNameValue = watch('studioName') ?? '';
  const descriptionValue = watch('description') ?? '';

  const isLoading = isPending;

  const onSubmit = (data: SignupFormValues) => {
    setFormError(null);
    startTransition(async () => {
      const result = await submitSignup({
        email: data.email,
        studioName: data.studioName,
        contactPhone: data.contactPhone || null,
        description: data.description,
        locale,
      });

      if (result.success) {
        setIsSuccess(true);
        requestAnimationFrame(() => {
          successHeadingRef.current?.focus();
        });
      } else {
        // Rate limit and generic errors both show the generic error message
        // since we don't want to reveal rate limiting details
        setFormError(t('errors.genericError'));
        requestAnimationFrame(() => {
          errorBannerRef.current?.focus();
        });
      }
    });
  };

  // Focus first invalid field on validation error
  const onError = () => {
    // react-hook-form processes errors; focus the first field with an error
    const firstErrorField = (['email', 'studioName', 'description'] as const).find(
      (field) => errors[field],
    );
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div aria-live="polite" className="flex flex-col items-center text-center py-4">
        <CheckCircle2 size={32} className="text-success-500 mx-auto" aria-hidden="true" />
        <h3
          ref={successHeadingRef}
          tabIndex={-1}
          className="font-heading text-2xl font-semibold text-neutral-800 text-center mt-4
            focus-visible:outline-none"
        >
          {t('successTitle')}
        </h3>
        <p className="text-sm text-neutral-500 text-center mt-2">{t('successMessage')}</p>
      </div>
    );
  }

  // ── Idle / Loading state ───────────────────────────────────────────────────

  const emailError = (() => {
    const m = errors.email?.message;
    if (m === 'emailRequired') return t('errors.emailRequired');
    if (m === 'emailInvalid') return t('errors.emailInvalid');
    return m ? t('errors.emailInvalid') : null;
  })();

  const studioNameError = (() => {
    const m = errors.studioName?.message;
    if (m === 'studioNameRequired') return t('errors.studioNameRequired');
    if (m === 'studioNameTooLong') return t('errors.studioNameTooLong');
    return m ? t('errors.studioNameRequired') : null;
  })();

  const descriptionError = (() => {
    const m = errors.description?.message;
    if (m === 'descriptionRequired') return t('errors.descriptionRequired');
    if (m === 'descriptionTooLong') return t('errors.descriptionTooLong');
    return m ? t('errors.descriptionTooLong') : null;
  })();

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onError)}
      aria-label={t('title')}
      aria-busy={isLoading ? 'true' : undefined}
      noValidate
    >
      {/* Form-level error banner */}
      {formError && (
        <div
          ref={errorBannerRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 rounded-lg bg-danger-50 border border-danger-500
            p-3 mb-4 focus-visible:outline-none"
        >
          <AlertCircle size={16} className="text-danger-500 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-danger-700">{formError}</p>
        </div>
      )}

      {/* Email field */}
      <div className="mb-4">
        <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-700 mb-1">
          {t('fields.email')}
          <span className="text-danger-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </label>
        <input
          {...register('email')}
          id="signup-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          placeholder={t('fields.emailPlaceholder')}
          required
          disabled={isLoading}
          aria-invalid={emailError ? 'true' : undefined}
          aria-describedby={emailError ? 'signup-email-error' : undefined}
          className={[
            'w-full h-11 rounded-lg border bg-white px-4',
            'text-base text-neutral-700 placeholder:text-neutral-400',
            'hover:border-neutral-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'focus-visible:ring-brand-600 focus-visible:border-brand-600',
            'motion-safe:transition-colors motion-safe:duration-150',
            emailError
              ? 'border-danger-500 focus-visible:ring-danger-500 focus-visible:border-danger-500'
              : 'border-neutral-200',
            isLoading ? 'bg-neutral-100 opacity-70 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {emailError && (
          <p
            id="signup-email-error"
            role="alert"
            className="flex items-center gap-1 text-xs text-danger-700 mt-1"
          >
            <AlertCircle size={12} aria-hidden="true" />
            {emailError}
          </p>
        )}
      </div>

      {/* Studio name field */}
      <div className="mb-4">
        <label
          htmlFor="signup-studioName"
          className="block text-sm font-medium text-neutral-700 mb-1"
        >
          {t('fields.studioName')}
          <span className="text-danger-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </label>
        <input
          {...register('studioName')}
          id="signup-studioName"
          type="text"
          autoComplete="organization"
          maxLength={100}
          placeholder={t('fields.studioNamePlaceholder')}
          required
          disabled={isLoading}
          aria-invalid={studioNameError ? 'true' : undefined}
          aria-describedby={
            [
              studioNameError ? 'signup-studioName-error' : '',
              studioNameValue.length > 80 ? 'signup-studioName-counter' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={[
            'w-full h-11 rounded-lg border bg-white px-4',
            'text-base text-neutral-700 placeholder:text-neutral-400',
            'hover:border-neutral-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'focus-visible:ring-brand-600 focus-visible:border-brand-600',
            'motion-safe:transition-colors motion-safe:duration-150',
            studioNameError
              ? 'border-danger-500 focus-visible:ring-danger-500 focus-visible:border-danger-500'
              : 'border-neutral-200',
            isLoading ? 'bg-neutral-100 opacity-70 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {studioNameValue.length > 80 && (
          <p
            id="signup-studioName-counter"
            aria-live="polite"
            className="text-xs text-neutral-400 mt-1 text-right"
          >
            {t('charCount', { current: String(studioNameValue.length), max: '100' })}
          </p>
        )}
        {studioNameError && (
          <p
            id="signup-studioName-error"
            role="alert"
            className="flex items-center gap-1 text-xs text-danger-700 mt-1"
          >
            <AlertCircle size={12} aria-hidden="true" />
            {studioNameError}
          </p>
        )}
      </div>

      {/* Contact phone field (optional) */}
      <div className="mb-4">
        <label
          htmlFor="signup-contactPhone"
          className="block text-sm font-medium text-neutral-700 mb-1"
        >
          {t('fields.contactPhone')}
          <span className="ml-2 text-xs text-neutral-400 font-normal border border-neutral-200 rounded px-1.5 py-0.5">
            {t('fields.contactPhoneOptional')}
          </span>
        </label>
        <input
          {...register('contactPhone')}
          id="signup-contactPhone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder={t('fields.contactPhonePlaceholder')}
          disabled={isLoading}
          className={[
            'w-full h-11 rounded-lg border border-neutral-200 bg-white px-4',
            'text-base text-neutral-700 placeholder:text-neutral-400',
            'hover:border-neutral-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'focus-visible:ring-brand-600 focus-visible:border-brand-600',
            'motion-safe:transition-colors motion-safe:duration-150',
            isLoading ? 'bg-neutral-100 opacity-70 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>

      {/* Description field */}
      <div className="mb-6">
        <label
          htmlFor="signup-description"
          className="block text-sm font-medium text-neutral-700 mb-1"
        >
          {t('fields.description')}
        </label>
        <textarea
          {...register('description')}
          id="signup-description"
          rows={4}
          maxLength={1000}
          placeholder={t('fields.descriptionPlaceholder')}
          disabled={isLoading}
          aria-invalid={descriptionError ? 'true' : undefined}
          aria-describedby={
            [
              descriptionError ? 'signup-description-error' : '',
              descriptionValue.length > 800 ? 'signup-description-counter' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={[
            'w-full rounded-lg border bg-white px-4 py-3',
            'text-base text-neutral-700 placeholder:text-neutral-400',
            'resize-none',
            'hover:border-neutral-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'focus-visible:ring-brand-600 focus-visible:border-brand-600',
            'motion-safe:transition-colors motion-safe:duration-150',
            descriptionError
              ? 'border-danger-500 focus-visible:ring-danger-500 focus-visible:border-danger-500'
              : 'border-neutral-200',
            isLoading ? 'bg-neutral-100 opacity-70 cursor-not-allowed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {descriptionValue.length > 800 && (
          <p
            id="signup-description-counter"
            aria-live="polite"
            className="text-xs text-neutral-400 mt-1 text-right"
          >
            {t('charCount', { current: String(descriptionValue.length), max: '1000' })}
          </p>
        )}
        {descriptionError && (
          <p
            id="signup-description-error"
            role="alert"
            className="flex items-center gap-1 text-xs text-danger-700 mt-1"
          >
            <AlertCircle size={12} aria-hidden="true" />
            {descriptionError}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading ? 'true' : undefined}
        aria-disabled={isLoading ? 'true' : undefined}
        className={[
          'w-full h-11 rounded-lg bg-brand-700 px-6 text-base font-medium text-white',
          'flex items-center justify-center gap-2',
          'hover:bg-brand-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
          'focus-visible:ring-offset-2',
          'motion-safe:transition-colors motion-safe:duration-150',
          'disabled:cursor-not-allowed disabled:opacity-70',
        ].join(' ')}
      >
        {isLoading && (
          <Loader2 size={18} className="motion-safe:animate-spin shrink-0" aria-hidden="true" />
        )}
        {isLoading ? t('submittingButton') : t('submitButton')}
      </button>

      {/* Privacy disclosure — LFPDPPP Art. 22 + 23 simplified notice entry point.
          Rendered below the submit button, above "already have an account".
          Uses next-intl rich text to embed <a> links within the translated string.
          Both privacyLink and arcoEmail render as real <a> elements (not modals/tooltips).
          See: docs/design/components/SignupForm.md §Addendum: Privacy Disclosure Line
          Ticket: CU-869d8202d */}
      <p className="text-xs text-neutral-500 leading-relaxed mt-4 mb-2">
        {t.rich('privacyDisclosure', {
          privacyLink: (chunks) => (
            <a
              href={locale === 'en' ? '/en/privacy-policy' : '/aviso-de-privacidad'}
              className={[
                'text-brand-600 hover:text-brand-700 underline underline-offset-2',
                'motion-safe:transition-colors motion-safe:duration-150',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-sm',
              ].join(' ')}
              target="_self"
            >
              {chunks}
            </a>
          ),
          arcoEmail: (chunks) => (
            <a
              href="mailto:privacy@massage-tulum.dirk-jan.com"
              className={[
                'text-brand-600 hover:text-brand-700 underline underline-offset-2',
                'motion-safe:transition-colors motion-safe:duration-150',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-sm',
              ].join(' ')}
            >
              {chunks}
            </a>
          ),
        })}
      </p>

      {/* Already have an account link */}
      <p className="text-sm text-center mt-4">
        <a
          href={locale === 'en' ? '/en/login' : '/login'}
          className={[
            'text-brand-600 hover:underline underline-offset-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
            'focus-visible:ring-offset-2 rounded',
            isLoading ? 'pointer-events-none opacity-50' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          tabIndex={isLoading ? -1 : undefined}
        >
          {t('alreadyHaveAccount')}
        </a>
      </p>
    </form>
  );
}
