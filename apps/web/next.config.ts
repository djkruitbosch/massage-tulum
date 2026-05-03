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
});

export default nextConfig;
