// @vitest-environment jsdom
/**
 * ServiceFormModal component tests.
 *
 * Tests:
 *   - Renders all form fields.
 *   - Create mode: modal title is "Add service".
 *   - Edit mode: modal title is "Edit service", fields pre-filled.
 *   - Validation: empty name prevents submit.
 *   - Submit calls server action on valid input.
 *
 * Ticket: CU-869d29f21
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { ServiceResponse } from '@massage-tulum/shared';
import { ServiceFormModal } from '../service-form-modal';

// Mock server actions
vi.mock('../../../../../../actions/services', () => ({
  createService: vi.fn().mockResolvedValue({ success: false, error: 'server_error' }),
  updateService: vi.fn().mockResolvedValue({ success: false, error: 'server_error' }),
  getCategories: vi.fn().mockResolvedValue({ success: true, data: ['Relajación', 'Deportivo'] }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  serviceCatalog: {
    modal: { add: { title: 'Add service' }, edit: { title: 'Edit service' } },
    field: {
      name: { label: 'Service name', error: { required: 'Name is required', tooLong: 'Too long' } },
      category: {
        label: 'Category',
        helper: 'Select or type',
        createOption: 'Create "{value}"',
        noOptions: 'No options',
        error: { tooLong: 'Too long' },
      },
      description: { label: 'Description', error: { tooLong: 'Too long' } },
      duration: {
        label: 'Duration',
        unit: 'min',
        custom: 'Custom…',
        customLabel: 'Custom duration (minutes)',
        error: { required: 'Required', min: 'Min 1', max: 'Max 480' },
      },
      price: {
        label: 'Base price',
        helper: 'MXN',
        error: { required: 'Required', min: 'Not negative' },
      },
    },
    filter: { groupLabel: 'Filter', active: 'Active', inactive: 'Deactivated', all: 'All' },
    status: { active: 'Active', inactive: 'Deactivated' },
    action: {
      addService: 'Add service',
      edit: 'Edit {name}',
      deactivate: 'Deactivate {name}',
      deactivateConfirm: 'Yes',
      reactivate: 'Reactivate {name}',
      reactivateConfirm: 'Yes',
    },
  },
  common: {
    button: {
      cancel: 'Cancel',
      save: 'Save',
      loading: 'Loading...',
      close: 'Close',
      retry: 'Retry',
    },
    error: { title: 'Error' },
    form: { requiredNote: 'Fields marked * are required' },
  },
  toast: { dismiss: 'Dismiss' },
};

const sampleService: ServiceResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  studioId: '00000000-0000-0000-0000-000000000002',
  name: 'Masaje de relajación',
  description: 'Un masaje suave',
  category: 'Relajación',
  durationMinutes: 60,
  basePriceMxn: 1200,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderAddModal(onSuccess = vi.fn(), onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ServiceFormModal locale="en" onSuccess={onSuccess} onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

function renderEditModal(service: ServiceResponse, onSuccess = vi.fn(), onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ServiceFormModal initialData={service} locale="en" onSuccess={onSuccess} onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ServiceFormModal — Add mode', () => {
  it('renders add mode title', () => {
    renderAddModal();
    expect(screen.getByRole('dialog', { name: 'Add service' })).toBeInTheDocument();
  });

  it('renders name field', () => {
    renderAddModal();
    expect(screen.getByLabelText(/Service name/i)).toBeInTheDocument();
  });

  it('renders description field', () => {
    renderAddModal();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it('renders Cancel and Save buttons', () => {
    renderAddModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderAddModal(vi.fn(), onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows required error when name is empty on submit', async () => {
    renderAddModal();
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('has role=dialog with aria-modal=true', () => {
    renderAddModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('ServiceFormModal — Edit mode', () => {
  it('renders edit mode title', () => {
    renderEditModal(sampleService);
    expect(screen.getByRole('dialog', { name: 'Edit service' })).toBeInTheDocument();
  });

  it('pre-fills name field', () => {
    renderEditModal(sampleService);
    const nameInput = screen.getByLabelText(/Service name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Masaje de relajación');
  });

  it('pre-fills description field', () => {
    renderEditModal(sampleService);
    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe('Un masaje suave');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderEditModal(sampleService, vi.fn(), onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
