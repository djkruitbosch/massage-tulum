// @vitest-environment jsdom

/**
 * TimePicker component tests.
 *
 * Tests the behaviour of the time picker wrapper:
 *   - renders an input[type=time] with the correct value
 *   - calls onChange with the new value
 *   - associates label with input via htmlFor/id
 *   - applies aria-invalid when hasError is true
 *   - applies aria-describedby when errorId is provided and hasError
 *
 * Ticket: CU-869d8cp2d
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from './time-picker';

describe('TimePicker', () => {
  it('renders a time input with the provided value', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} label="Open" />);
    // type=time inputs aren't textboxes in all browsers — use getByLabelText
    expect(screen.getByLabelText(/Open/i)).toHaveValue('09:00');
  });

  it('renders an empty input when value is null', () => {
    render(<TimePicker value={null} onChange={vi.fn()} label="Open" />);
    const input = screen.getByLabelText(/Open/i);
    expect(input).toHaveValue('');
  });

  it('calls onChange with new value when user changes input', async () => {
    const handleChange = vi.fn();
    render(<TimePicker value="09:00" onChange={handleChange} label="Open" />);
    const input = screen.getByLabelText(/Open/i);
    await userEvent.clear(input);
    await userEvent.type(input, '14:30');
    expect(handleChange).toHaveBeenCalled();
  });

  it('associates the label with the input via id', () => {
    render(<TimePicker value="10:00" onChange={vi.fn()} label="Close time" id="close-1" />);
    const input = screen.getByLabelText(/Close time/i);
    expect(input).toHaveAttribute('id', 'close-1');
  });

  it('sets aria-invalid when hasError is true', () => {
    render(<TimePicker value="20:00" onChange={vi.fn()} label="Close" hasError={true} />);
    const input = screen.getByLabelText(/Close/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-describedby when hasError and errorId are provided', () => {
    render(
      <TimePicker value="20:00" onChange={vi.fn()} label="Close" hasError={true} errorId="err-1" />,
    );
    const input = screen.getByLabelText(/Close/i);
    expect(input).toHaveAttribute('aria-describedby', 'err-1');
  });

  it('does not set aria-describedby when hasError is false', () => {
    render(
      <TimePicker value="09:00" onChange={vi.fn()} label="Open" hasError={false} errorId="err-2" />,
    );
    const input = screen.getByLabelText(/Open/i);
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('is disabled when disabled prop is true', () => {
    render(<TimePicker value="09:00" onChange={vi.fn()} label="Open" disabled={true} />);
    const input = screen.getByLabelText(/Open/i);
    expect(input).toBeDisabled();
  });
});
