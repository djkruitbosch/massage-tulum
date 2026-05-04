'use client';

/**
 * LoginForm — client component.
 *
 * State machine: idle → loading → sent | error → idle
 *
 * Validates on submit (not on blur — per spec AC-3 and LoginForm.md).
 * On success: transitions to "sent" card state with focus on the success heading.
 * On error: returns to idle with error banner and focus on the banner.
 *
 * Uses react-hook-form + zod for validation.
 * Calls the requestMagicLink server action — passes locale so the email
 * template can render bilingual content via {{ .Data.locale }} conditional.
 *
 * Ref: docs/design/components/LoginForm.md
 * Ticket: CU-869d4za67
 */

import { AlertCircle, Loader2, Mail } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { requestMagicLink } from '../../../../actions/auth';

const loginSchema = z.object({
  email: z.string().min(1, 'required').max(254, 'invalid').email('invalid'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type FormState = 'idle' | 'loading' | 'sent';
type BannerError = 'link_expired' | 'invalid_link' | 'too_many_requests' | 'generic_error' | null;

interface LoginFormProps {
  initialError?: 'link_expired' | 'invalid_link' | null;
  locale: string;
}

export function LoginForm({ initialError = null, locale }: LoginFormProps) {
  const t = useTranslations('auth.login');
  const [formState, setFormState] = useState<FormState>('idle');
  const [bannerError, setBannerError] = useState<BannerError>(initialError ?? null);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const isLoading = formState === 'loading' || isPending;

  const onSubmit = (data: LoginFormValues) => {
    setBannerError(null);
    setFormState('loading');

    startTransition(async () => {
      const result = await requestMagicLink(data.email, locale);

      if (result.success) {
        setSubmittedEmail(data.email);
        setFormState('sent');
        // Focus the success heading for screen reader announcement
        requestAnimationFrame(() => {
          successHeadingRef.current?.focus();
        });
      } else {
        setFormState('idle');
        setBannerError(result.error);
        // Focus the error banner for screen reader announcement
        requestAnimationFrame(() => {
          errorBannerRef.current?.focus();
        });
      }
    });
  };

  const handleResend = () => {
    setBannerError(null);
    setFormState('idle');
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (formState === 'sent') {
    return (
      <div aria-live="polite" className="flex flex-col items-center text-center">
        <Mail size={24} className="text-success-500 mt-2" aria-hidden="true" />
        <h3
          ref={successHeadingRef}
          tabIndex={-1}
          className="font-heading text-2xl font-semibold text-neutral-800 text-center mt-4
            focus-visible:outline-none"
        >
          {t('successTitle')}
        </h3>
        <p className="text-sm text-neutral-500 text-center mt-2">
          {/* Render email interpolation separately to avoid JSX-in-translation issues */}
          {t('successMessage', { email: submittedEmail })}
        </p>
        <p className="text-xs text-neutral-500 text-center mt-6">
          {t('resendPrompt')}{' '}
          <button
            type="button"
            onClick={handleResend}
            className="text-brand-600 underline-offset-2 hover:underline
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600
              focus-visible:ring-offset-2 rounded"
          >
            {t('resendButton')}
          </button>
        </p>
      </div>
    );
  }

  // ── Idle / Loading state ───────────────────────────────────────────────────
  const emailError =
    errors.email?.message === 'required'
      ? t('errors.emailRequired')
      : errors.email?.message === 'invalid'
        ? t('errors.emailInvalid')
        : errors.email
          ? t('errors.emailInvalid')
          : null;

  const bannerMessage =
    bannerError === 'link_expired'
      ? t('errors.linkExpired')
      : bannerError === 'invalid_link'
        ? t('errors.invalidLink')
        : bannerError === 'too_many_requests'
          ? t('errors.tooManyRequests')
          : bannerError === 'generic_error'
            ? t('errors.genericError')
            : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label={t('title')} noValidate>
      {/* Error banner */}
      {bannerMessage && (
        <div
          ref={errorBannerRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 rounded-lg bg-danger-50 border border-danger-500
            p-3 mb-4 focus-visible:outline-none"
        >
          <AlertCircle size={16} className="text-danger-500 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm text-danger-700">{bannerMessage}</p>
        </div>
      )}

      {/* Email field */}
      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
          {t('emailLabel')}
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          placeholder={t('emailPlaceholder')}
          readOnly={isLoading}
          aria-invalid={emailError ? 'true' : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
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
            isLoading ? 'bg-neutral-100 cursor-default' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {emailError && (
          <p
            id="email-error"
            role="alert"
            className="flex items-center gap-1 text-xs text-danger-700 mt-1"
          >
            <AlertCircle size={12} aria-hidden="true" />
            {emailError}
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

      {/* Sign-up link */}
      <p className="text-sm text-center mt-4">
        <a
          href={locale === 'en' ? '/en/signup' : '/signup'}
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
          {t('firstTime')}
        </a>
      </p>
    </form>
  );
}
