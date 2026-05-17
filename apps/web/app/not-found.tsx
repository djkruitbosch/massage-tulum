/**
 * Root not-found page for the App Router.
 *
 * Satisfies Next.js 15's requirement for a root-level `not-found.tsx`
 * when the app uses the `[locale]` dynamic segment. Without it, Next
 * falls back to the legacy pages-router `_error` page for the `/404`
 * pre-render, which trips a build-time error:
 *   "Html should not be imported outside of pages/_document"
 *
 * The locale-aware 404 lives in `app/[locale]/not-found.tsx` and handles
 * every path matched by the next-intl middleware. This root file only
 * renders for paths the middleware never sees (the static `/404`
 * fallback), so it cannot know the user's locale — copy is bilingual,
 * Spanish-first (matches the default locale), with inline styles
 * because the root layout intentionally does not load globals.css.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Página no encontrada / Page not found',
};

const containerStyle = {
  display: 'flex',
  minHeight: '100vh',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#1f2937',
  backgroundColor: '#f9fafb',
};

const codeStyle = {
  fontSize: '3rem',
  fontWeight: 700,
  margin: '0 0 0.5rem',
  color: '#0f766e',
};

const headingStyle = {
  fontSize: '1.5rem',
  fontWeight: 600,
  margin: '0 0 0.75rem',
};

const bodyStyle = {
  fontSize: '1rem',
  margin: '0 0 2rem',
  color: '#6b7280',
  textAlign: 'center' as const,
  maxWidth: '32rem',
};

const linkStyle = {
  display: 'inline-block',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  backgroundColor: '#0f766e',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 500,
};

export default function RootNotFound() {
  return (
    <main style={containerStyle}>
      <div aria-hidden="true" style={codeStyle}>
        404
      </div>
      <h1 style={headingStyle}>
        <span lang="es">Página no encontrada</span>
        <span aria-hidden="true"> · </span>
        <span lang="en">Page not found</span>
      </h1>
      <p style={bodyStyle}>
        <span lang="es">La página que buscas no existe.</span>
        <br />
        <span lang="en">The page you are looking for does not exist.</span>
      </p>
      <Link href="/" style={linkStyle}>
        <span lang="es">Volver al inicio</span>
        <span aria-hidden="true"> · </span>
        <span lang="en">Back to home</span>
      </Link>
    </main>
  );
}
