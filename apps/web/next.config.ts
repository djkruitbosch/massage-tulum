import createNextIntlPlugin from 'next-intl/plugin';

/**
 * next-intl plugin wiring.
 *
 * - Loads request config from `i18n/request.ts`.
 * - `createMessagesDeclaration` generates a TypeScript declaration file
 *   from `messages/es.json` (the canonical locale) so missing translation
 *   keys produce build-time TypeScript errors rather than silent `undefined`.
 *
 * See: docs/research/2026-04-26-foundation.md §R4
 */
const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: './messages/es.json',
  },
});

const nextConfig = withNextIntl({
  // Strict TypeScript mode is enforced via tsconfig.json.
  // TypeScript errors fail the build.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Disable the X-Powered-By header.
  poweredByHeader: false,
  // No inline <script> tags are used in this app — CSP middleware (ticket FE-3,
  // CU-869d29n0x) will be implemented separately and does not require any
  // next.config.ts header configuration.
  //
  // Transpile @massage-tulum/shared so Next.js compiles the TypeScript source
  // directly (packages/shared/src) without requiring a pre-built dist/.
  // The tsconfig.json path alias points to the src entry point.
  // This is needed when running `next build` without first running
  // `pnpm --filter @massage-tulum/shared build` (i.e. outside Turborepo).
  transpilePackages: ['@massage-tulum/shared'],
  webpack(config) {
    // The shared package (packages/shared) uses NodeNext ESM convention:
    // internal imports end in '.js' but the actual source files are '.ts'.
    // extensionAlias tells webpack to try '.ts'/'.tsx' before '.js'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config as any).resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
     
    return config;
  },
});

export default nextConfig;
