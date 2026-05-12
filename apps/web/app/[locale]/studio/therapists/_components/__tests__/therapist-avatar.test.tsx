// @vitest-environment jsdom
/**
 * TherapistAvatar component tests.
 *
 * Tests focus on observable behavior:
 *   - Renders <img> when photoUrl is provided.
 *   - Renders initials when photoUrl is null.
 *   - Falls back to initials on image load error.
 *   - Correct initials for various name formats.
 *   - Correct size classes for sm/lg sizes.
 *   - Accessible role="img" + aria-label.
 *
 * Ticket: CU-869d8k3yv
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TherapistAvatar, getInitials } from '../therapist-avatar';

afterEach(() => {
  cleanup();
});

// ── getInitials helper ────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('returns first + last initial for a two-word name', () => {
    expect(getInitials('Ana Martinez')).toBe('AM');
  });

  it('returns first initial only for a single-word name', () => {
    expect(getInitials('Ana')).toBe('A');
  });

  it('uses first and last word for multi-word names', () => {
    expect(getInitials('Maria del Carmen')).toBe('MC');
  });

  it('handles extra whitespace', () => {
    expect(getInitials('  Ana  Martinez  ')).toBe('AM');
  });

  it('returns empty string for empty name', () => {
    expect(getInitials('')).toBe('');
  });

  it('uppercases initials', () => {
    expect(getInitials('ana martinez')).toBe('AM');
  });
});

// ── TherapistAvatar component ─────────────────────────────────────────────────

describe('TherapistAvatar', () => {
  describe('when photoUrl is provided', () => {
    it('renders an img element', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl="https://example.com/photo.jpg" />);
      expect(screen.getByRole('img', { name: 'Ana Martinez' }).querySelector('img')).toBeTruthy();
    });

    it('img has loading=lazy', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl="https://example.com/photo.jpg" />);
      const wrapper = screen.getByRole('img', { name: 'Ana Martinez' });
      const img = wrapper.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('img has alt="" (decorative)', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl="https://example.com/photo.jpg" />);
      const wrapper = screen.getByRole('img', { name: 'Ana Martinez' });
      const img = wrapper.querySelector('img');
      expect(img).toHaveAttribute('alt', '');
    });

    it('falls back to initials on image error', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl="https://example.com/broken.jpg" />);
      const wrapper = screen.getByRole('img', { name: 'Ana Martinez' });
      const img = wrapper.querySelector('img')!;
      fireEvent.error(img);
      // After error, img should be gone and initials should appear
      expect(wrapper.querySelector('img')).toBeNull();
      expect(wrapper.textContent).toContain('AM');
    });
  });

  describe('when photoUrl is null', () => {
    it('does not render an img element', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl={null} />);
      const wrapper = screen.getByRole('img', { name: 'Ana Martinez' });
      expect(wrapper.querySelector('img')).toBeNull();
    });

    it('renders initials for two-word name', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl={null} />);
      expect(screen.getByRole('img', { name: 'Ana Martinez' }).textContent).toContain('AM');
    });

    it('renders single initial for one-word name', () => {
      render(<TherapistAvatar name="Ana" photoUrl={null} />);
      expect(screen.getByRole('img', { name: 'Ana' }).textContent).toContain('A');
    });

    it('renders "MC" for "Maria del Carmen"', () => {
      render(<TherapistAvatar name="Maria del Carmen" photoUrl={null} />);
      expect(screen.getByRole('img', { name: 'Maria del Carmen' }).textContent).toContain('MC');
    });
  });

  describe('accessibility', () => {
    it('has role="img" on the wrapper', () => {
      render(<TherapistAvatar name="Ana Martinez" photoUrl={null} />);
      expect(screen.getByRole('img', { name: 'Ana Martinez' })).toBeInTheDocument();
    });

    it('uses ariaLabel prop when provided', () => {
      render(
        <TherapistAvatar name="Ana Martinez" photoUrl={null} ariaLabel="Photo of Ana Martinez" />,
      );
      expect(screen.getByRole('img', { name: 'Photo of Ana Martinez' })).toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('sm size applies h-8 w-8 classes', () => {
      render(<TherapistAvatar name="Ana" photoUrl={null} size="sm" />);
      const wrapper = screen.getByRole('img', { name: 'Ana' });
      expect(wrapper.className).toContain('h-8');
      expect(wrapper.className).toContain('w-8');
    });

    it('lg size applies h-24 w-24 classes', () => {
      render(<TherapistAvatar name="Ana" photoUrl={null} size="lg" />);
      const wrapper = screen.getByRole('img', { name: 'Ana' });
      expect(wrapper.className).toContain('h-24');
      expect(wrapper.className).toContain('w-24');
    });
  });
});
