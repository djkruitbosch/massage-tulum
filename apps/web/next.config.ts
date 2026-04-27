import type { NextConfig } from 'next';

// NOTE: next-intl plugin integration is handled in ticket FE-2 (CU-869d29n0n).
// This config intentionally omits withNextIntl() — FE-2 will add it.

const nextConfig: NextConfig = {
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
};

export default nextConfig;
