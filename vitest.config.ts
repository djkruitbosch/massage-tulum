import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in all workspace packages
    projects: [
      'packages/*/vitest.config.ts',
      'packages/*/vitest.config.mts',
      'apps/web/vitest.config.ts',
    ],
    // Global test reporter
    reporter: ['verbose'],
  },
});
