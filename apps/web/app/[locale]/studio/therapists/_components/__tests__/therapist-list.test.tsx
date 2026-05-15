// @vitest-environment jsdom
/**
 * TherapistList component tests.
 *
 * Tests focus on observable behavior:
 *   - Renders therapist names in the list.
 *   - Shows empty state when list is empty (active filter).
 *   - Shows different empty state for deactivated filter.
 *   - Filter buttons are present with correct labels.
 *   - "Add therapist" button is present.
 *
 * Note: Full filter URL-param behavior requires router integration which is
 * complex to test in isolation. We verify the filter UI renders correctly
 * and the filter change callback is triggered on click.
 *
 * Ticket: CU-869d8k3yv
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { Therapist } from '@massage-tulum/shared';
import { TherapistList } from '../therapist-list';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('status=active'),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  therapistRoster: {
    page: {
      title: 'Therapists',
      subtitle: 'Manage your studio team',
    },
    action: {
      addTherapist: 'Add therapist',
      edit: 'Edit {name}',
      deactivate: 'Deactivate {name}',
      deactivateConfirm: 'Yes, deactivate',
      reactivate: 'Reactivate {name}',
      reactivateConfirm: 'Yes, reactivate',
    },
    modal: {
      add: { title: 'Add therapist' },
      edit: { title: 'Edit therapist' },
    },
    field: {
      name: { label: 'Full name', error: { required: 'Name is required' } },
      role: { label: 'Role or specialty', error: { required: 'Role is required' } },
      phone: { label: 'Phone' },
      email: { label: 'Email', error: { format: 'Enter a valid email' } },
      notes: { label: 'Internal notes', helper: 'Max 500', charCount: '{count}/500' },
    },
    deactivate: {
      title: 'Deactivate {name}?',
      body: 'The therapist will no longer appear in new bookings.',
      warning: 'This therapist may have upcoming bookings.',
    },
    reactivate: {
      title: 'Reactivate {name}?',
      body: 'The therapist will become available for new bookings again.',
    },
    filter: {
      active: 'Active',
      deactivated: 'Deactivated',
      all: 'All',
    },
    list: {
      label: 'Therapist list',
    },
    status: {
      active: 'Active',
      deactivated: 'Deactivated',
    },
    loading: 'Loading therapists',
    empty: {
      active: {
        title: 'No active therapists',
        body: 'Add your first therapist to get started',
      },
      deactivated: {
        title: 'No deactivated therapists',
        body: 'Deactivated therapists will appear here',
      },
    },
    loadError: {
      title: 'Could not load the list',
      body: 'An error occurred while loading therapists.',
      retry: 'Retry',
    },
    avatar: {
      label: 'Photo of {name}',
      uploadPhoto: 'Upload photo',
      replacePhoto: 'Replace photo',
      removePhoto: 'Remove photo',
      fileHint: 'PNG, JPG, or WebP.',
      fileInput: { label: 'Select therapist photo' },
      uploading: 'Uploading...',
      error: { fileType: 'Invalid type.', fileSize: 'Too large.', uploadFailed: 'Failed.' },
      undo: { title: 'Removed', description: '', action: 'Undo' },
    },
    privacyDisclosure: 'By saving, you agree to our <privacyLink>Privacy Policy</privacyLink>.',
  },
  common: {
    button: { cancel: 'Cancel', save: 'Save', loading: 'Loading...', close: 'Close' },
    form: { requiredNote: 'Fields marked * are required' },
  },
  toast: {
    dismiss: 'Dismiss',
    error: { generic: { title: 'Error', description: 'Try again.' } },
    success: { saved: { title: 'Saved', description: 'Changes saved.' } },
  },
};

const activeTherapist: Therapist = {
  id: '00000000-0000-0000-0000-000000000001',
  studioId: '00000000-0000-0000-0000-000000000002',
  name: 'Ana Martinez',
  role: 'Deep Tissue Therapist',
  phone: null,
  email: null,
  notes: null,
  photoUrl: null,
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const inactiveTherapist: Therapist = {
  ...activeTherapist,
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Carlos Lopez',
  status: 'inactive',
};

function renderList(props: { therapists?: Therapist[]; filter?: 'active' | 'inactive' | 'all' }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TherapistList
        initialTherapists={props.therapists ?? [activeTherapist]}
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

describe('TherapistList', () => {
  describe('with therapists', () => {
    it('renders therapist names', () => {
      renderList({ therapists: [activeTherapist] });
      // The row renders in both desktop and mobile layouts (both visible in jsdom)
      const nameEls = screen.getAllByText('Ana Martinez');
      expect(nameEls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders therapist role', () => {
      renderList({ therapists: [activeTherapist] });
      const roleEls = screen.getAllByText('Deep Tissue Therapist');
      expect(roleEls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders multiple therapists', () => {
      renderList({ therapists: [activeTherapist, inactiveTherapist], filter: 'all' });
      expect(screen.getAllByText('Ana Martinez').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Carlos Lopez').length).toBeGreaterThanOrEqual(1);
    });

    it('has an accessible list with aria-label', () => {
      renderList({ therapists: [activeTherapist] });
      expect(screen.getByRole('list', { name: 'Therapist list' })).toBeInTheDocument();
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
      // After click, "All" should now be pressed
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Add therapist button', () => {
    it('renders "Add therapist" button', () => {
      renderList({});
      expect(screen.getAllByRole('button', { name: 'Add therapist' })[0]).toBeInTheDocument();
    });
  });

  describe('empty state — active filter', () => {
    it('shows empty state title for active filter with no therapists', () => {
      renderList({ therapists: [], filter: 'active' });
      expect(screen.getByText('No active therapists')).toBeInTheDocument();
    });

    it('shows CTA button in active filter empty state', () => {
      renderList({ therapists: [], filter: 'active' });
      // Both the header and empty-state Add buttons should be present
      const addButtons = screen.getAllByRole('button', { name: 'Add therapist' });
      expect(addButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('empty state — deactivated filter', () => {
    it('shows different empty state title for deactivated filter', () => {
      renderList({ therapists: [], filter: 'inactive' });
      expect(screen.getByText('No deactivated therapists')).toBeInTheDocument();
    });

    it('does not show CTA button in deactivated empty state', () => {
      renderList({ therapists: [], filter: 'inactive' });
      // Only the header "Add therapist" button should be present (not in the empty state)
      const addButtons = screen.getAllByRole('button', { name: 'Add therapist' });
      // Should be exactly 1 — the header button; the empty state has no CTA for deactivated
      expect(addButtons).toHaveLength(1);
    });
  });
});
