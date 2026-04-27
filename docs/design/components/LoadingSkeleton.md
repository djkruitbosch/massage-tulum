# Component: LoadingSkeleton

**Used in:** Foundation, all features that fetch data
**Designer doc:** `docs/design/foundation-home.md`
**Status:** Spec
**Date:** 2026-04-26

---

## Purpose

A generic shimmer-animated placeholder shown while data is being fetched. Replaces the actual content shape with gray blocks of matching proportions. Preferred over a spinner for page-level and section-level loading because it communicates the shape of the incoming content, reducing perceived latency.

**Spinner vs Skeleton decision rule:**
- Use **skeleton** when loading a section of content with a known shape (lists, cards, form fields, table rows).
- Use **spinner** (a single animated circle) for small inline actions (e.g., a button's loading state, an inline async operation).
- Never show a full-page spinner for page-level loading in the studio-owner UI.

---

## Anatomy

The LoadingSkeleton component is a low-level primitive that renders a single shimmer block. It is composed into higher-level patterns (e.g., a SkeletonCard, a SkeletonRow) via props and wrapper composition.

```
┌────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░ shimmer ░░░░░░░░  │  <- single skeleton block
└────────────────────────────────────┘
```

The shimmer is a CSS gradient animation that moves left-to-right, suggesting content is loading.

---

## Props

```typescript
interface LoadingSkeletonProps {
  // Dimensions
  width?: string;        // CSS width. Default: '100%'. Examples: '200px', '50%', '6rem'
  height?: string;       // CSS height. Default: '1rem' (matches body text). Examples: '2rem', '120px'

  // Shape
  rounded?: 'sm' | 'md' | 'lg' | 'full'; // Border radius. Default: 'md' (8px)

  // Layout
  className?: string;    // Additional Tailwind classes for positioning/margin

  // Accessibility
  // The skeleton itself has aria-hidden="true" — it's decorative.
  // The containing section must have aria-busy="true" and aria-label describing what is loading.
}
```

---

## Visual Specification

**Base appearance:**
- Background: `bg-neutral-200`
- Shimmer overlay: a `background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)` moving left-to-right.

**In Tailwind/CSS terms:**
The shimmer is implemented via a `@keyframes` animation class (compiled into the Tailwind stylesheet, not inline). The developer-fe should add this keyframe to `tailwind.config.ts` or `globals.css`:

```css
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

**Tailwind classes for the skeleton block:**
```
relative overflow-hidden rounded-lg bg-neutral-200
before:absolute before:inset-0
before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent
before:animate-[shimmer_1.5s_ease-in-out_infinite]
motion-reduce:before:animate-none
```

Note: `motion-reduce:before:animate-none` disables the shimmer animation entirely for users who prefer reduced motion. The static gray block is still shown as a placeholder — not blank.

---

## States

- **Default (loading):** Shimmer animates continuously.
- **Reduced motion:** Shimmer animation disabled. Block remains static gray (`bg-neutral-200`). Still communicates placeholder state via color.
- **No explicit error/empty/success state:** This component is purely a loading primitive. The parent component is responsible for replacing it with real content or an error state once the fetch resolves.

---

## Composition Patterns

The developer-fe composes LoadingSkeleton instances into context-specific loading shapes. No pre-built compound components at foundation — these are defined per feature. The following illustrate the pattern:

### Pattern A: Text line skeleton
```
<LoadingSkeleton height="1rem" width="80%" />
<LoadingSkeleton height="1rem" width="60%" className="mt-2" />
```

### Pattern B: Card skeleton (e.g., a booking card)
```
<div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
  <LoadingSkeleton height="1.25rem" width="50%" />          {/* title */}
  <LoadingSkeleton height="0.875rem" width="70%" />         {/* subtitle */}
  <LoadingSkeleton height="0.875rem" width="40%" />         {/* meta */}
  <div className="flex gap-2 mt-4">
    <LoadingSkeleton height="2.5rem" width="100px" />       {/* button */}
    <LoadingSkeleton height="2.5rem" width="100px" />       {/* button */}
  </div>
</div>
```

### Pattern C: Table row skeleton
```
<div className="flex gap-4 items-center py-3 border-b border-neutral-100">
  <LoadingSkeleton height="2rem" width="2rem" rounded="full" />  {/* avatar */}
  <LoadingSkeleton height="1rem" width="140px" />                 {/* name */}
  <LoadingSkeleton height="1rem" width="80px" className="ml-auto" /> {/* status */}
</div>
```

---

## Accessibility

- **ARIA:** The skeleton element itself has `aria-hidden="true"` — it is decorative. It adds no information.
- **Container role:** The container wrapping a group of skeletons MUST have `aria-busy="true"` while loading and `aria-live="polite"` so screen readers are notified when loading completes and real content appears.
- **Label:** The loading container SHOULD have `aria-label` describing what is loading: e.g., `aria-label="Cargando reservas" / "Loading bookings"`.
- **Example container markup:**
  ```
  <section aria-busy="true" aria-label="Cargando reservas" aria-live="polite">
    {/* skeleton blocks here */}
  </section>
  ```
  When the data loads, swap to:
  ```
  <section aria-busy="false" aria-live="polite">
    {/* real content here */}
  </section>
  ```

---

## Responsive Behavior

- **Desktop (≥1024px):** Full-width within container. Skeleton blocks match the intended content layout.
- **Tablet / Mobile:** Skeleton `width` should be responsive. Prefer `width="100%"` with `max-w-*` applied to the container. Avoid hardcoded pixel widths for skeletons on mobile.

---

## Tokens Used

- **Colors:** `neutral.200` (skeleton bg), `white` (shimmer highlight)
- **Border radius:** matches the actual component's radius — `rounded-lg` (8px) by default
- **Motion:** `1.5s ease-in-out infinite` shimmer — disabled when `prefers-reduced-motion: reduce`

---

## Copy Keys

The LoadingSkeleton has no user-facing copy. The accessible label is owned by the parent container.

| Key | es | en |
|---|---|---|
| `common.loading.generic` | Cargando... | Loading... |

This key is used by parent containers for their `aria-label` when no feature-specific label exists.

---

## Don'ts

- Don't show a skeleton for operations expected to complete in <200ms — the flash of skeleton is more jarring than the delay. Apply a short delay (300ms) before showing the skeleton.
- Don't animate the skeleton if the user has `prefers-reduced-motion` set — use `motion-reduce:animate-none`.
- Don't use a full-page spinner in place of a skeleton for content-heavy screens.
- Don't use inline styles for the shimmer animation — keep it in the Tailwind/CSS class layer to remain CSP-compliant.
