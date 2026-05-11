// This file intentionally left minimal — root error boundary for Next.js App Router.
// The locale-specific error experience is in app/[locale]/error.tsx.
// This file exists to prevent Next.js from using the legacy _error page for /500.
'use client';

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
