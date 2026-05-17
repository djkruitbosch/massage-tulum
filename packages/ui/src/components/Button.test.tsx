import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

// RTL does not auto-cleanup in vitest without a global setup; be explicit.
afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('renders label text as children', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toHaveAttribute('type', 'button');
  });

  it('uses primary variant by default (contains brand-700 class)', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button', { name: /primary/i });
    expect(btn.className).toContain('bg-brand-700');
  });

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button', { name: /secondary/i });
    expect(btn.className).toContain('bg-white');
    expect(btn.className).toContain('text-brand-700');
    expect(btn.className).toContain('border-brand-300');
  });

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: /ghost/i });
    expect(btn.className).toContain('text-neutral-600');
    expect(btn.className).not.toContain('bg-brand');
  });

  it('applies destructive variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: /delete/i });
    expect(btn.className).toContain('bg-danger-500');
    expect(btn.className).toContain('text-white');
  });

  it('applies sm size classes', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: /small/i });
    expect(btn.className).toContain('h-8');
    expect(btn.className).toContain('text-sm');
  });

  it('applies md size classes (default)', () => {
    render(<Button>Medium</Button>);
    const btn = screen.getByRole('button', { name: /medium/i });
    expect(btn.className).toContain('h-10');
    expect(btn.className).toContain('text-base');
  });

  it('applies lg size classes', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: /large/i });
    expect(btn.className).toContain('h-12');
  });

  it('applies w-full when fullWidth is true', () => {
    render(<Button fullWidth>Full</Button>);
    expect(screen.getByRole('button', { name: /full/i }).className).toContain('w-full');
  });

  it('sets disabled HTML attribute when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: /disabled/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled button
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: /disabled button/i }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('sets aria-busy="true" when loading', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button', { name: /loading/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('disables the button when loading', () => {
    render(<Button loading>Loading state</Button>);
    expect(screen.getByRole('button', { name: /loading state/i })).toBeDisabled();
  });

  it('does not fire onClick when loading', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading action
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: /loading action/i }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders a spinner SVG element when loading', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button', { name: /saving/i });
    const svg = btn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.getAttribute('class')).toContain('motion-safe:animate-spin');
  });

  it('label text remains visible (though dimmed) when loading', () => {
    render(<Button loading>Saving data</Button>);
    // The label span is inside the button; visible to DOM
    expect(screen.getByText('Saving data')).toBeInTheDocument();
  });

  it('renders leadingIcon when not loading', () => {
    render(<Button leadingIcon={<span data-testid="icon" />}>With icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('hides leadingIcon when loading (spinner replaces it)', () => {
    render(
      <Button loading leadingIcon={<span data-testid="icon" />}>
        Save
      </Button>,
    );
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  it('accepts and forwards arbitrary HTML button attributes', () => {
    render(<Button data-testid="my-btn">Custom attrs</Button>);
    expect(screen.getByTestId('my-btn')).toBeInTheDocument();
  });

  it('merges additional className with base classes', () => {
    render(<Button className="custom-class">Merge</Button>);
    expect(screen.getByRole('button', { name: /merge/i }).className).toContain('custom-class');
  });
});
