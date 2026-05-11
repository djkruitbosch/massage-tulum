/**
 * Root layout — App Router.
 *
 * This minimal root layout is required to prevent Next.js 15 from falling back
 * to the legacy pages-router `_error` handler when pre-rendering the `/404`
 * and `/500` static fallback pages. Without it, the build fails with:
 *   "Html should not be imported outside of pages/_document"
 *
 * The actual page layout (with next-intl, fonts, and providers) is in
 * `app/[locale]/layout.tsx` — that layout wraps all user-facing pages.
 * This root layout only serves as the HTML/body shell for the fallback pages
 * (not-found.tsx and error.tsx at the root level).
 */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
