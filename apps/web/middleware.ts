import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { buildCsp } from './lib/csp';

/**
 * Combined middleware: CSP nonce generation + next-intl locale detection.
 *
 * Execution order per request:
 *   1. Generate a cryptographically random nonce (base64-encoded UUID).
 *   2. Run next-intl middleware (locale detection, redirect if needed).
 *   3. Set `Content-Security-Policy` and `x-nonce` headers on the response
 *      (whether it is a normal 200 or a 307 locale redirect — the redirect
 *      case is fine: the browser follows the redirect and a fresh nonce is
 *      generated on the next request).
 *
 * Server Components that need to inject a nonce into inline <script> tags
 * (e.g. analytics snippets added in future sprints) must read the nonce via:
 *   import { headers } from 'next/headers';
 *   const nonce = (await headers()).get('x-nonce') ?? '';
 *
 * Matcher excludes:
 *   - /_next/static  (static assets)
 *   - /_next/image   (image optimisation)
 *   - /favicon.ico   (favicon)
 *   - /api           (NestJS proxy routes — intentionally excluded)
 *
 * Ref: docs/adr/0006-csp-nextjs-app-router.md
 * Ticket: CU-869d29n0x (FE-3)
 */
const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildCsp(nonce);

  const response = intlMiddleware(request);

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - /_next/static  (Next.js static assets)
     *   - /_next/image   (Next.js image optimization)
     *   - /favicon.ico   (favicon)
     *   - /api           (API route handlers — NestJS proxy routes)
     *
     * next-intl only processes page routes; excluding assets avoids
     * unnecessary locale detection overhead on static file requests.
     * The /api exclusion is intentional: NestJS proxy routes must not
     * be intercepted by the i18n middleware.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api).*)',
  ],
};
