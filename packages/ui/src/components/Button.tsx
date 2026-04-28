/**
 * Button component — implements docs/design/components/Button.md exactly.
 *
 * Class composition approach: hand-rolled conditional class strings (no cva/clsx dep).
 * Rationale: packages/ui must stay minimal at Foundation — adding cva would be a new
 * architectural dependency requiring an ADR. The variant × size × state matrix is small
 * enough to express clearly without a helper library.
 *
 * Server Component compatible: no 'use client' directive. This component has no hooks,
 * no browser-only APIs, and no event handlers that require client hydration. Consumers
 * in apps/web can import it from Server Components directly.
 *
 * Tailwind note: packages/ui emits class name strings only. The consumer app (apps/web)
 * must include packages/ui in its Tailwind content glob so JIT can detect and compile
 * these classes. No Tailwind dependency in this package.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Default: 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Size. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** When true: shows spinner, sets aria-busy, disables interaction. Default: false. */
  loading?: boolean;
  /** Stretches button to full container width. Default: false. */
  fullWidth?: boolean;
  /** Optional leading icon (Lucide component). Replaced by spinner when loading. */
  leadingIcon?: React.ReactNode;
  /** Optional trailing icon (Lucide component). */
  trailingIcon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Base classes shared by all variants and sizes
// ---------------------------------------------------------------------------

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium ' +
  'focus-visible:outline-none ' +
  'motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out';

// ---------------------------------------------------------------------------
// Variant class maps
// ---------------------------------------------------------------------------

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-700 text-white ' +
    'hover:bg-brand-600 ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ' +
    'active:bg-brand-800 ' +
    'disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed',

  secondary:
    'bg-white text-brand-700 border border-brand-300 ' +
    'hover:bg-brand-50 hover:border-brand-400 ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ' +
    'active:bg-brand-100 active:border-brand-500 ' +
    'disabled:bg-white disabled:text-neutral-400 disabled:border-neutral-200 disabled:cursor-not-allowed',

  ghost:
    'text-neutral-600 ' +
    'hover:bg-neutral-100 hover:text-neutral-700 ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ' +
    'active:bg-neutral-200 active:text-neutral-800 ' +
    'disabled:text-neutral-300 disabled:cursor-not-allowed',

  destructive:
    'bg-danger-500 text-white ' +
    'hover:bg-danger-700 ' +
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-danger-500 ' +
    'active:bg-danger-700 ' +
    'disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed',
};

// ---------------------------------------------------------------------------
// Size class maps
// ---------------------------------------------------------------------------

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 py-1.5 text-sm',
  md: 'h-10 px-4 py-2 text-base',
  lg: 'h-12 px-6 py-3 text-base',
};

// ---------------------------------------------------------------------------
// Loading text opacity per variant (label remains visible but dimmed)
// ---------------------------------------------------------------------------

const LOADING_LABEL_OPACITY: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'text-white/70',
  secondary: 'text-brand-700/60',
  ghost: 'text-neutral-600/60',
  destructive: 'text-white/70',
};

// ---------------------------------------------------------------------------
// Spinner (inline SVG — CSP-safe, React-rendered, no external script)
// Matches Lucide Loader2 appearance: circle arc that rotates.
// Size follows the design spec: 16px for sm, 20px for md/lg.
// ---------------------------------------------------------------------------

function Spinner({ size }: { size: NonNullable<ButtonProps['size']> }) {
  const px = size === 'sm' ? 16 : 20;
  return (
    <svg
      aria-hidden="true"
      className="animate-spin text-current"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Full circle (faint track) */}
      <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
      {/* Arc segment (spinning indicator) */}
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const classes = [
    BASE,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {/* Leading icon slot — replaced by spinner when loading */}
      {loading ? (
        <Spinner size={size} />
      ) : leadingIcon ? (
        <span aria-hidden="true" className="contents">
          {leadingIcon}
        </span>
      ) : null}

      {/* Label — dimmed opacity when loading */}
      <span className={loading ? LOADING_LABEL_OPACITY[variant] : undefined}>{children}</span>

      {/* Trailing icon slot — hidden when loading to avoid clutter */}
      {!loading && trailingIcon ? (
        <span aria-hidden="true" className="contents">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
}
