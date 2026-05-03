import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

/**
 * next-intl locale-detection middleware.
 *
 * Locale routing:
 *   - `/`   → Spanish (default locale, no prefix per `as-needed`)
 *   - `/en` → English
 *
 * Structure: the intlMiddleware is called inside an explicit `middleware`
 * function (rather than exported directly as `export default createMiddleware(...)`)
 * so that the CSP nonce middleware (ticket FE-3, CU-869d29n0x) can be combined
 * here without changing the public function signature.
 *
 * TODO(CU-869d29n0x): combine with CSP nonce middleware here.
 * When FE-3 is implemented, generate a nonce, call intlMiddleware(request),
 * then attach Content-Security-Policy and x-nonce headers to the response
 * before returning. See ADR-0006 and docs/research/2026-04-26-foundation.md §R5.
 */
const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - /_next/static  (Next.js static assets)
     *   - /_next/image   (Next.js image optimization)
     *   - /favicon.ico   (favicon)
     *   - /api           (API route handlers, if any)
     *
     * next-intl only processes page routes; excluding assets avoids
     * unnecessary locale detection overhead on static file requests.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api).*)',
  ],
};
