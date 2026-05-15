// @vitest-environment jsdom
/**
 * TherapistForm component tests.
 *
 * Tests focus on observable behavior:
 *   - Empty name fails validation.
 *   - Empty role fails validation.
 *   - Valid name + role passes (submit called).
 *   - Max length: name > 120 fails.
 *   - Max length: role > 80 fails.
 *   - Adds mode: submit button shows "Add therapist".
 *   - Edit mode: submit button shows "Save".
 *   - Privacy disclosure link renders.
 *   - aria-invalid set on invalid fields.
 *
 * Ticket: CU-869d8k3yv
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { TherapistForm } from '../therapist-form';
import type { CreateTherapistInput, Therapist, UpdateTherapistInput } from '@massage-tulum/shared';

// Mock the server actions.
// Path from test file: ../../../../../../actions/therapists
// (from __tests__/ going up 6 levels to apps/web/)
vi.mock('../../../../../../actions/therapists', () => ({
  uploadTherapistPhoto: vi.fn(),
  removeTherapistPhoto: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  therapistRoster: {
    field: {
      name: {
        label: 'Full name',
        error: { required: 'Name is required' },
      },
      role: {
        label: 'Role or specialty',
        error: { required: 'Role is required' },
      },
      phone: { label: 'Phone' },
      email: {
        label: 'Email',
        error: { format: 'Enter a valid email address' },
      },
      notes: {
        label: 'Internal notes',
        helper: 'Maximum 500 characters.',
        charCount: '{count}/500',
      },
    },
    action: {
      addTherapist: 'Add therapist',
    },
    avatar: {
      uploadPhoto: 'Upload photo',
      replacePhoto: 'Replace photo',
      removePhoto: 'Remove photo',
      fileHint: 'PNG, JPG, or WebP.',
      fileInput: { label: 'Select therapist photo' },
      uploading: 'Uploading...',
      error: {
        fileType: 'Invalid file type.',
        fileSize: 'File is too large.',
        uploadFailed: 'Upload failed.',
      },
      undo: { title: 'Photo removed', description: '', action: 'Undo' },
    },
    privacyDisclosure: 'By saving, you agree to our <privacyLink>Privacy Policy</privacyLink>.',
  },
  common: {
    button: {
      cancel: 'Cancel',
      save: 'Save',
      loading: 'Loading...',
    },
    form: {
      requiredNote: 'Fields marked * are required',
    },
  },
  toast: {
    error: {
      generic: {
        title: 'Something went wrong',
        description: 'Please try again.',
      },
    },
  },
};

const mockTherapist: Therapist = {
  id: '00000000-0000-0000-0000-000000000001',
  studioId: '00000000-0000-0000-0000-000000000002',
  name: 'Ana Martinez',
  role: 'Massage Therapist',
  phone: '+52 984 000 0001',
  email: 'ana@studio.com',
  notes: 'Specializes in deep tissue.',
  photoUrl: null,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderForm(props: {
  initialData?: Therapist | null;
  onSuccess?: (t: Therapist) => void;
  onCancel?: () => void;
  onSubmit?: (
    input: CreateTherapistInput | UpdateTherapistInput,
  ) => Promise<{ success: true; data: Therapist } | { success: false; error: string }>;
}) {
  const onSuccess = props.onSuccess ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const defaultSubmit = vi.fn().mockResolvedValue({ success: true, data: mockTherapist });
  const onSubmit = props.onSubmit ?? defaultSubmit;

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TherapistForm
        initialData={props.initialData}
        locale="en"
        onSuccess={onSuccess}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TherapistForm', () => {
  describe('add mode (no initialData)', () => {
    it('renders name and role fields', () => {
      renderForm({});
      expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Role or specialty/i)).toBeInTheDocument();
    });

    it('shows "Add therapist" on submit button', () => {
      renderForm({});
      expect(screen.getByRole('button', { name: 'Add therapist' })).toBeInTheDocument();
    });

    it('shows Cancel button', () => {
      renderForm({});
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('edit mode (with initialData)', () => {
    it('pre-fills name field', () => {
      renderForm({ initialData: mockTherapist });
      expect(screen.getByLabelText(/Full name/i)).toHaveValue('Ana Martinez');
    });

    it('pre-fills role field', () => {
      renderForm({ initialData: mockTherapist });
      expect(screen.getByLabelText(/Role or specialty/i)).toHaveValue('Massage Therapist');
    });

    it('shows "Save" on submit button', () => {
      renderForm({ initialData: mockTherapist });
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  describe('validation — empty name', () => {
    it('shows name required error on submit', async () => {
      renderForm({});
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('sets aria-invalid on name input when empty', async () => {
      renderForm({});
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Full name/i)).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('validation — empty role', () => {
    it('shows role required error on submit', async () => {
      renderForm({});
      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Ana' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(screen.getByText('Role is required')).toBeInTheDocument();
      });
    });
  });

  describe('validation — max length', () => {
    it('fails when name exceeds 120 characters', async () => {
      renderForm({});
      const longName = 'A'.repeat(121);
      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: longName } });
      fireEvent.change(screen.getByLabelText(/Role or specialty/i), {
        target: { value: 'Therapist' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        // Name field should be invalid (max constraint)
        expect(screen.getByLabelText(/Full name/i)).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('fails when role exceeds 80 characters', async () => {
      renderForm({});
      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Ana' } });
      const longRole = 'R'.repeat(81);
      fireEvent.change(screen.getByLabelText(/Role or specialty/i), {
        target: { value: longRole },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Role or specialty/i)).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('valid submission', () => {
    it('calls onSubmit with correct values', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true, data: mockTherapist });
      renderForm({ onSubmit: mockSubmit });

      fireEvent.change(screen.getByLabelText(/Full name/i), {
        target: { value: 'Ana Martinez' },
      });
      fireEvent.change(screen.getByLabelText(/Role or specialty/i), {
        target: { value: 'Deep Tissue Therapist' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Ana Martinez',
            role: 'Deep Tissue Therapist',
          }),
        );
      });
    });

    it('calls onSuccess after successful submit', async () => {
      const onSuccess = vi.fn();
      const mockSubmit = vi.fn().mockResolvedValue({ success: true, data: mockTherapist });
      renderForm({
        onSuccess,
        onSubmit: mockSubmit,
      });

      fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Ana' } });
      fireEvent.change(screen.getByLabelText(/Role or specialty/i), {
        target: { value: 'Therapist' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockTherapist);
      });
    });
  });

  describe('privacy disclosure', () => {
    it('renders a link in the privacy disclosure', () => {
      renderForm({});
      expect(screen.getByRole('link', { name: /Privacy Policy/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('name field has associated label', () => {
      renderForm({});
      expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    });

    it('role field has associated label', () => {
      renderForm({});
      expect(screen.getByLabelText(/Role or specialty/i)).toBeInTheDocument();
    });

    it('error messages have role=alert', async () => {
      renderForm({});
      fireEvent.click(screen.getByRole('button', { name: 'Add therapist' }));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });
  });
});
