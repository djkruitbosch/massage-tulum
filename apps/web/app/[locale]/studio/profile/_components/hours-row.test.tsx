// @vitest-environment jsdom

/**
 * HoursRow component tests.
 *
 * Tests the behaviour of a single hours grid row:
 *   - renders day label (full name on sm+, short name on mobile via CSS classes)
 *   - renders closed switch with correct role and aria-checked
 *   - hides time pickers when day is closed
 *   - shows time pickers when day is open
 *   - calls onToggle when switch is clicked
 *   - renders close-after-open error message when provided
 *
 * Ticket: CU-869d8cp2d
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HoursRow } from './hours-row';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, string>) => {
    const translations: Record<string, Record<string, string>> = {
      'studioProfile.hours': {
        open: 'Open',
        close: 'Close',
        closed: 'Closed',
        closedLabel: 'Closed',
        'toggleClosed.label': `Mark ${params?.day ?? ''} as closed`,
        'toggleOpen.label': `Mark ${params?.day ?? ''} as open`,
        'error.closeAfterOpen': 'Close time must be after open time',
      },
    };
    return translations[ns]?.[key] ?? `${ns}.${key}`;
  },
}));

const defaultProps = {
  weekday: 1,
  fullDayName: 'Monday',
  shortDayName: 'Mon',
  isOpen: false,
  openTime: null,
  closeTime: null,
  onToggle: vi.fn(),
  onOpenTimeChange: vi.fn(),
  onCloseTimeChange: vi.fn(),
};

describe('HoursRow', () => {
  it('renders the full day name', () => {
    render(<HoursRow {...defaultProps} />);
    // Full name in a hidden-on-mobile span
    const fullNameEl = document.querySelector('.hidden.sm\\:block');
    expect(fullNameEl?.textContent).toContain('Monday');
  });

  it('renders the short day name for mobile', () => {
    render(<HoursRow {...defaultProps} />);
    const shortNameEl = document.querySelector('.sm\\:hidden');
    expect(shortNameEl?.textContent).toContain('Mon');
  });

  it('renders a switch button with role="switch"', () => {
    render(<HoursRow {...defaultProps} isOpen={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
  });

  it('has aria-checked="true" when day is closed (toggle represents the closed state)', () => {
    render(<HoursRow {...defaultProps} isOpen={false} />);
    const toggle = screen.getByRole('switch');
    // When isOpen=false the "closed" state is active → aria-checked=true
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('has aria-checked="false" when day is open', () => {
    render(<HoursRow {...defaultProps} isOpen={true} openTime="09:00" closeTime="18:00" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('hides time pickers when day is closed', () => {
    render(<HoursRow {...defaultProps} isOpen={false} />);
    // Use exact label text to avoid matching the switch button's aria-label
    expect(screen.queryByLabelText('Open')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('shows time pickers when day is open', () => {
    render(<HoursRow {...defaultProps} isOpen={true} openTime="09:00" closeTime="18:00" />);
    expect(screen.getByLabelText('Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('calls onToggle with true when closed day switch is clicked', async () => {
    const onToggle = vi.fn();
    render(<HoursRow {...defaultProps} isOpen={false} onToggle={onToggle} />);
    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('calls onToggle with false when open day switch is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <HoursRow
        {...defaultProps}
        isOpen={true}
        openTime="09:00"
        closeTime="18:00"
        onToggle={onToggle}
      />,
    );
    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('renders the close-after-open error when provided', () => {
    render(
      <HoursRow
        {...defaultProps}
        isOpen={true}
        openTime="18:00"
        closeTime="09:00"
        closeAfterOpenError="Close time must be after open time"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Close time must be after open time');
  });

  it('does not render error when closeAfterOpenError is not provided', () => {
    render(<HoursRow {...defaultProps} isOpen={true} openTime="09:00" closeTime="18:00" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
