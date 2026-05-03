/**
 * Root not-found page for the App Router.
 *
 * This file satisfies Next.js App Router's requirement for a root-level
 * `not-found.tsx` when the app uses the `[locale]` dynamic segment pattern.
 * Without it, Next.js 15 falls back to the legacy pages-router `_error` page
 * for the `/404` pre-render, which triggers a build-time error:
 *   "Html should not be imported outside of pages/_document"
 *
 * The locale-specific 404 experience is handled by
 * `app/[locale]/not-found.tsx` (to be added when the first authenticated
 * route needs it). This root-level file is intentionally minimal.
 */
export default function RootNotFound() {
  return null;
}
