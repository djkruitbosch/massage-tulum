// @vitest-environment jsdom
/**
 * DurationPicker component tests.
 *
 * Tests:
 *   - All 9 preset chips render.
 *   - "Custom…" chip renders.
 *   - Clicking a preset selects it (aria-pressed=true).
 *   - Clicking "Custom…" shows the custom input.
 *   - Custom input calls onChange with parsed number.
 *   - Edit mode: preset pre-selected if value matches.
 *   - Edit mode: "Custom…" pre-selected if value doesn't match preset.
 *
 * Ticket: CU-869d29f21
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { DurationPicker } from '../duration-picker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  serviceCatalog: {
    field: {
      duration: {
        label: 'Duration',
        unit: 'min',
        custom: 'Custom…',
        customLabel: 'Custom duration (minutes)',
        error: { required: 'Required', min: 'Min 1', max: 'Max 480' },
      },
    },
  },
};

function renderPicker(value: number | null | undefined = null, onChange = vi.fn(), error?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DurationPicker value={value} onChange={onChange} error={error} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DurationPicker', () => {
  it('renders all 9 preset chips', () => {
    renderPicker();
    const presets = [
      '30 min',
      '45 min',
      '1 hr',
      '1 hr 15 min',
      '1 hr 30 min',
      '1 hr 45 min',
      '2 hr',
      '2 hr 30 min',
      '3 hr',
    ];
    for (const label of presets) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('renders Custom… chip', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: 'Custom…' })).toBeInTheDocument();
  });

  it('has aria-pressed=true on the 60-min chip when value=60', () => {
    renderPicker(60);
    const chip60 = screen.getByRole('button', { name: '1 hr' });
    expect(chip60).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a preset chip calls onChange with that value', () => {
    const onChange = vi.fn();
    renderPicker(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: '45 min' }));
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('clicking Custom… shows the custom input', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Custom…' }));
    expect(screen.getByLabelText('Custom duration (minutes)')).toBeInTheDocument();
  });

  it('custom input calls onChange with parsed integer', async () => {
    const onChange = vi.fn();
    renderPicker(null, onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Custom…' }));
    const input = screen.getByLabelText('Custom duration (minutes)');
    fireEvent.change(input, { target: { value: '55' } });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(55);
    });
  });

  it('pre-selects preset chip when value matches a preset (edit mode)', () => {
    renderPicker(90);
    const chip90 = screen.getByRole('button', { name: '1 hr 30 min' });
    expect(chip90).toHaveAttribute('aria-pressed', 'true');
    // Custom chip should not be pressed
    expect(screen.getByRole('button', { name: 'Custom…' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('pre-selects Custom… when value does not match preset (edit mode)', () => {
    renderPicker(55);
    expect(screen.getByRole('button', { name: 'Custom…' })).toHaveAttribute('aria-pressed', 'true');
    // Custom input should be shown with value 55
    const input = screen.getByLabelText('Custom duration (minutes)') as HTMLInputElement;
    expect(input.value).toBe('55');
  });

  it('shows error message when error prop is provided', () => {
    renderPicker(null, vi.fn(), 'Min 1');
    expect(screen.getByRole('alert')).toHaveTextContent('Min 1');
  });

  it('all preset chips have aria-pressed attribute', () => {
    renderPicker();
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('aria-pressed');
    }
  });
});
