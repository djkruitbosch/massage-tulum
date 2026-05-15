// @vitest-environment jsdom
/**
 * ServiceList component tests.
 *
 * Tests focus on observable behavior:
 *   - Renders service names in the list.
 *   - Shows empty state when list is empty (active filter).
 *   - Shows different empty state for deactivated filter.
 *   - Filter buttons are present with correct labels.
 *   - "Add service" button is present.
 *   - Optimistic updates after filter change.
 *
 * Ticket: CU-869d29f21
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { ServiceResponse } from '@massage-tulum/shared';
import { ServiceList } from '../service-list';

// Mock server actions
vi.mock('../../../../../../actions/services', () => ({
  listServices: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getCategories: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createService: vi.fn(),
  updateService: vi.fn(),
  getFutureBookingsCount: vi
    .fn()
    .mockResolvedValue({ success: true, data: { futureBookingsCount: 0 } }),
  deactivateService: vi.fn(),
  reactivateService: vi.fn(),
}));

// Mock next/navigation (not used in ServiceList but imported by some deps)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  serviceCatalog: {
    page: { title: 'Service catalog', subtitle: 'Define the services your studio offers' },
    action: {
      addService: 'Add service',
      edit: 'Edit {name}',
      deactivate: 'Deactivate {name}',
      deactivateConfirm: 'Yes, deactivate',
      reactivate: 'Reactivate {name}',
      reactivateConfirm: 'Yes, reactivate',
    },
    modal: {
      add: { title: 'Add service' },
      edit: { title: 'Edit service' },
    },
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
        customLabel: 'Custom duration',
        error: { required: 'Required', min: 'Min 1', max: 'Max 480' },
      },
      price: {
        label: 'Base price',
        helper: 'MXN',
        error: { required: 'Required', min: 'Not negative' },
      },
    },
    deactivate: {
      title: 'Deactivate "{name}"?',
      body: 'No longer available.',
      hasBookings: 'Has {count} bookings.',
    },
    reactivate: { title: 'Reactivate "{name}"?', body: 'Will be available again.' },
    filter: {
      groupLabel: 'Filter by status',
      active: 'Active',
      inactive: 'Deactivated',
      all: 'All',
    },
    list: { label: 'Service list' },
    status: { active: 'Active', inactive: 'Deactivated' },
    loading: 'Loading services',
    empty: {
      active: { title: 'No active services', body: 'Add your first service' },
      deactivated: {
        title: 'No deactivated services',
        body: 'Deactivated services will appear here',
      },
    },
    loadError: { title: 'Could not load', body: 'Error loading.', retry: 'Retry' },
    toast: {
      created: 'Created.',
      updated: 'Updated.',
      deactivated: 'Deactivated.',
      reactivated: 'Reactivated.',
    },
    duration: { format: '{n} min', formatHours: '{h} hr {m} min' },
  },
  common: {
    button: {
      cancel: 'Cancel',
      save: 'Save',
      loading: 'Loading...',
      close: 'Close',
      retry: 'Retry',
    },
    error: { title: 'Error', body: 'Reload page.', reload: 'Reload' },
    form: { requiredNote: 'Required fields marked *' },
  },
  toast: {
    dismiss: 'Dismiss',
    error: { generic: { title: 'Error', description: 'Try again.' } },
    success: { saved: { title: 'Saved', description: 'Changes saved.' } },
  },
};

const activeService: ServiceResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  studioId: '00000000-0000-0000-0000-000000000002',
  name: 'Masaje de relajación',
  description: null,
  category: 'Relajación',
  durationMinutes: 60,
  basePriceMxn: 1200,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const inactiveService: ServiceResponse = {
  ...activeService,
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Masaje deportivo',
  category: null,
  status: 'inactive',
};

function renderList(props: {
  services?: ServiceResponse[];
  filter?: 'active' | 'inactive' | 'all';
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ServiceList
        initialServices={props.services ?? [activeService]}
        initialFilter={props.filter ?? 'active'}
        locale="en"
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ServiceList', () => {
  describe('with services', () => {
    it('renders service name in the list', () => {
      renderList({ services: [activeService] });
      const nameEls = screen.getAllByText('Masaje de relajación');
      expect(nameEls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders category pill when service has category', () => {
      renderList({ services: [activeService] });
      const categoryEls = screen.getAllByText('Relajación');
      expect(categoryEls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders multiple services', () => {
      renderList({ services: [activeService, inactiveService], filter: 'all' });
      expect(screen.getAllByText('Masaje de relajación').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Masaje deportivo').length).toBeGreaterThanOrEqual(1);
    });

    it('has an accessible list with aria-label', () => {
      renderList({ services: [activeService] });
      expect(screen.getByRole('list', { name: 'Service list' })).toBeInTheDocument();
    });
  });

  describe('filter bar', () => {
    it('renders Active, Deactivated, and All filter buttons', () => {
      renderList({});
      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Deactivated' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    });

    it('Active button has aria-pressed=true when filter=active', () => {
      renderList({ filter: 'active' });
      expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('filter button press updates aria-pressed state', () => {
      renderList({ filter: 'active' });
      const allButton = screen.getByRole('button', { name: 'All' });
      fireEvent.click(allButton);
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Add service button', () => {
    it('renders "Add service" button', () => {
      renderList({});
      expect(screen.getAllByRole('button', { name: 'Add service' })[0]).toBeInTheDocument();
    });
  });

  describe('empty state — active filter', () => {
    it('shows empty state title for active filter with no services', () => {
      renderList({ services: [], filter: 'active' });
      expect(screen.getByText('No active services')).toBeInTheDocument();
    });

    it('shows CTA button in active filter empty state', () => {
      renderList({ services: [], filter: 'active' });
      const addButtons = screen.getAllByRole('button', { name: 'Add service' });
      expect(addButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('empty state — deactivated filter', () => {
    it('shows deactivated empty state title', () => {
      renderList({ services: [], filter: 'inactive' });
      expect(screen.getByText('No deactivated services')).toBeInTheDocument();
    });

    it('does not show CTA in deactivated empty state', () => {
      renderList({ services: [], filter: 'inactive' });
      // Only the header "Add service" button should be present
      const addButtons = screen.getAllByRole('button', { name: 'Add service' });
      expect(addButtons).toHaveLength(1);
    });
  });

  describe('empty state — all filter', () => {
    it('shows active empty state when filter=all and no services', () => {
      renderList({ services: [], filter: 'all' });
      expect(screen.getByText('No active services')).toBeInTheDocument();
    });
  });

  describe('Add service modal', () => {
    it('opens add modal when Add service button is clicked', () => {
      renderList({});
      const addButton = screen.getAllByRole('button', { name: 'Add service' })[0]!;
      fireEvent.click(addButton);
      expect(screen.getByRole('dialog', { name: 'Add service' })).toBeInTheDocument();
    });
  });
});
