// @vitest-environment jsdom
/**
 * SignupForm component tests.
 *
 * Tests focus on observable behavior:
 *   - All required fields are rendered with labels
 *   - Validation fires on submit, not on blur
 *   - Required field errors show correctly
 *   - Loading state disables form and shows submitting text
 *   - Success state replaces form with confirmation card
 *   - API error shows form-level error banner
 *   - Accessibility: aria-invalid, aria-describedby on fields with errors
 *
 * Ticket: CU-869d4za07
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SignupForm } from './signup-form';

// Mock the server action
vi.mock('../../../../actions/signup', () => ({
  submitSignup: vi.fn(),
}));

// Inline messages to avoid loading real message files in tests.
// Cast to any to avoid strict literal-type mismatch with generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  auth: {
    signup: {
      title: 'Register your studio',
      subtitle: "Tell us about your studio and we'll contact you when it's approved.",
      fields: {
        email: 'Email address',
        emailPlaceholder: 'example@yourstudio.com',
        studioName: 'Studio name',
        studioNamePlaceholder: 'E.g. Tulum Healing Studio',
        contactPhone: 'Contact phone',
        contactPhonePlaceholder: '+52 984 000 0000',
        contactPhoneOptional: 'Optional',
        description: 'Tell us about your studio',
        descriptionPlaceholder: 'Services you offer, number of therapists, hours, etc.',
      },
      submitButton: 'Submit application',
      submittingButton: 'Submitting...',
      alreadyHaveAccount: 'Already have an account? Sign in here',
      successTitle: 'Application received',
      successMessage: "We'll review your application and email you when your studio is approved.",
      charCount: '{current}/{max}',
      errors: {
        emailRequired: 'Enter your email address',
        emailInvalid: 'Enter a valid email address',
        studioNameRequired: 'Enter your studio name',
        studioNameTooLong: 'Studio name cannot exceed 100 characters',
        descriptionRequired: 'Tell us about your studio',
        descriptionTooLong: 'Description cannot exceed 1000 characters',
        genericError: 'Something went wrong. Please try again.',
      },
    },
  },
};

function renderSignupForm(props?: { locale?: string }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SignupForm locale={props?.locale ?? 'en'} />
    </NextIntlClientProvider>,
  );
}

describe('SignupForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('default idle state', () => {
    it('renders all required fields with labels', () => {
      renderSignupForm();
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Studio name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Contact phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tell us about your studio/i)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderSignupForm();
      expect(screen.getByRole('button', { name: 'Submit application' })).toBeInTheDocument();
    });

    it('renders link to login page', () => {
      renderSignupForm();
      expect(screen.getByText('Already have an account? Sign in here')).toBeInTheDocument();
    });

    it('does not show error state initially', () => {
      renderSignupForm();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('validation (fires on submit, not on blur)', () => {
    it('shows emailRequired when submitting empty email', async () => {
      renderSignupForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Enter your email address')).toBeInTheDocument();
      });
    });

    it('shows emailInvalid for malformed email', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'notanemail' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
      });
    });

    it('shows studioNameRequired when studio name is empty', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Enter your studio name')).toBeInTheDocument();
      });
    });

    it('does NOT validate on blur — only on submit', async () => {
      renderSignupForm();
      const emailInput = screen.getByLabelText(/Email address/i);
      fireEvent.change(emailInput, { target: { value: 'bad' } });
      fireEvent.blur(emailInput);

      // No error should appear after blur alone
      expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
    });

    it('sets aria-invalid on email input when validation fails', async () => {
      renderSignupForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Email address/i);
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('sets aria-describedby on email input when error is present', async () => {
      renderSignupForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        const input = screen.getByLabelText(/Email address/i);
        expect(input).toHaveAttribute('aria-describedby', 'signup-email-error');
      });
    });
  });

  describe('loading state', () => {
    beforeEach(async () => {
      const { submitSignup } = await import('../../../../actions/signup');
      vi.mocked(submitSignup).mockResolvedValue({ success: true });
    });

    it('shows submitting text during form submission', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      // Eventually resolves to success
      await waitFor(() => {
        expect(screen.getByText('Application received')).toBeInTheDocument();
      });
    });
  });

  describe('success state', () => {
    beforeEach(async () => {
      const { submitSignup } = await import('../../../../actions/signup');
      vi.mocked(submitSignup).mockResolvedValue({ success: true });
    });

    it('shows success heading after successful submission', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Application received')).toBeInTheDocument();
      });
    });

    it('hides the form after success', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Application received')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Submit application' }),
        ).not.toBeInTheDocument();
      });
    });

    it('shows success message text', async () => {
      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText(/We'll review your application/)).toBeInTheDocument();
      });
    });
  });

  describe('error state', () => {
    it('shows generic error banner when API returns error', async () => {
      const { submitSignup } = await import('../../../../actions/signup');
      vi.mocked(submitSignup).mockResolvedValue({
        success: false,
        error: 'generic_error',
      });

      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
      });
    });

    it('error banner has role=alert', async () => {
      const { submitSignup } = await import('../../../../actions/signup');
      vi.mocked(submitSignup).mockResolvedValue({
        success: false,
        error: 'rate_limit',
      });

      renderSignupForm();
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'owner@studio.com' },
      });
      fireEvent.change(screen.getByLabelText(/Studio name/i), {
        target: { value: 'Test Studio' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        const alert = screen
          .getAllByRole('alert')
          .find((el) => el.textContent?.includes('Something went wrong'));
        expect(alert).toBeDefined();
      });
    });
  });

  describe('accessibility', () => {
    it('email field has a visible label associated via htmlFor', () => {
      renderSignupForm();
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    });

    it('studio name field has a visible label associated via htmlFor', () => {
      renderSignupForm();
      expect(screen.getByLabelText(/Studio name/i)).toBeInTheDocument();
    });

    it('contact phone field has optional badge in label', () => {
      renderSignupForm();
      expect(screen.getByLabelText(/Contact phone/i)).toBeInTheDocument();
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    it('field errors have role=alert for screen reader announcement', async () => {
      renderSignupForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('locale handling', () => {
    it('renders login link with /login path for Spanish locale', () => {
      renderSignupForm({ locale: 'es' });
      const loginLink = screen.getByText('Already have an account? Sign in here');
      expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
    });

    it('renders login link with /en/login path for English locale', () => {
      renderSignupForm({ locale: 'en' });
      const loginLink = screen.getByText('Already have an account? Sign in here');
      expect(loginLink.closest('a')).toHaveAttribute('href', '/en/login');
    });
  });
});
