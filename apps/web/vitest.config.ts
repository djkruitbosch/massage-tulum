import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment is correct for Next.js middleware tests.
    // Middleware runs in the Edge runtime (globalThis.crypto is available in Node 22).
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Top-level await is used in middleware.test.ts for dynamic import after mocks.
    // vitest supports this natively.
  },
});
