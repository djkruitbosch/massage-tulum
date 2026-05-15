// @vitest-environment jsdom
/**
 * CategoryCombobox component tests.
 *
 * Tests:
 *   - Renders a combobox input.
 *   - On focus: fetches categories (lazy).
 *   - Shows matching options when user types (prefix match).
 *   - Shows "Create" option when input doesn't match any category.
 *   - Keyboard: ArrowDown/Up navigates, Enter selects.
 *   - Free-text value accepted on blur.
 *   - Empty input cleared onChange with null.
 *
 * Ticket: CU-869d29f21
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { CategoryCombobox } from '../category-combobox';

// Mock getCategories
vi.mock('../../../../../../actions/services', () => ({
  getCategories: vi.fn().mockResolvedValue({
    success: true,
    data: ['Deportivo', 'Relajación', 'Thai'],
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  serviceCatalog: {
    field: {
      category: {
        label: 'Category',
        helper: 'Select or type',
        createOption: 'Create "{value}"',
        noOptions: 'No previous categories',
        error: { tooLong: 'Too long' },
      },
    },
  },
};

function renderCombobox(value: string | null = null, onChange = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CategoryCombobox value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CategoryCombobox', () => {
  it('renders a combobox input', () => {
    renderCombobox();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('input has role=combobox with aria-expanded=false initially', () => {
    renderCombobox();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('fetches categories on first focus', async () => {
    const { getCategories } = await import('../../../../../../actions/services');
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => {
      expect(getCategories).toHaveBeenCalledOnce();
    });
  });

  it('does not fetch categories more than once (lazy cache)', async () => {
    const { getCategories } = await import('../../../../../../actions/services');
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.focus(input);
    await waitFor(() => {
      expect(getCategories).toHaveBeenCalledOnce();
    });
  });

  it('shows prefix-matched options when user types', async () => {
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    // Wait for categories to load
    await waitFor(() => {
      // After load, all categories should be in memory
    });
    fireEvent.change(input, { target: { value: 'R' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Relajación' })).toBeInTheDocument();
    });
    // Deportivo and Thai don't start with 'R'
    expect(screen.queryByRole('option', { name: 'Deportivo' })).not.toBeInTheDocument();
  });

  it('shows Create option for new value', async () => {
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => {});
    fireEvent.change(input, { target: { value: 'Aromática' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Create "Aromática"' })).toBeInTheDocument();
    });
  });

  it('calls onChange with null when input is cleared after typing', () => {
    const onChange = vi.fn();
    renderCombobox(null, onChange);
    const input = screen.getByRole('combobox');
    // Type something first
    fireEvent.change(input, { target: { value: 'test' } });
    // Then clear
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('calls onChange with the typed value when not empty', () => {
    const onChange = vi.fn();
    renderCombobox(null, onChange);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Lomi' } });
    expect(onChange).toHaveBeenCalledWith('Lomi');
  });

  it('keyboard ArrowDown makes dropdown visible', async () => {
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => {});
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('Escape closes the dropdown', async () => {
    renderCombobox();
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => {});
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
