import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@massage-tulum/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    // Node environment is the default for middleware tests.
    // Component tests use jsdom (set per-file with @vitest-environment jsdom).
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // globals: true is required for @testing-library/jest-dom matchers to work
    // (the library extends the global expect object at import time).
    globals: true,
    // Setup file extends expect with jest-dom matchers for component tests.
    setupFiles: ['./vitest.setup.ts'],
  },
});
