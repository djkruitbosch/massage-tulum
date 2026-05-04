import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { buildCsp } from './lib/csp';

/**
 * Combined middleware: Supabase session refresh + route protection +
 * next-intl locale detection + CSP nonce generation.
 *
 * Execution order per request:
 *   1. Supabase session refresh — calls getUser() to trigger token refresh
 *      and write updated auth cookies back via setAll. Must run first so
 *      Server Components see a fresh session.
 *   2. Route protection — redirect unauthenticated users from /dashboard
 *      (and future protected paths) to /login?next=<path>.
 *      Redirect authenticated users from /login to /dashboard.
 *   3. next-intl middleware — locale detection + redirect if needed.
 *   4. Merge Supabase auth cookies onto the intl response and set
 *      Content-Security-Policy + x-nonce headers.
 *
 * IMPORTANT: use getUser() (not getSession() or getClaims()) in middleware
 * for the token-refresh cookie write cycle.
 * Ref: docs/research/2026-05-03-studio-owner-auth.md §R5
 *
 * Middleware ordering per ADR-0006 + ADR-0007.
 * Ref: docs/adr/0006-csp-nextjs-app-router.md
 * Ref: docs/adr/0007-supabase-auth-magic-link.md
 * Ticket: CU-869d4za67
 */

const intlMiddleware = createIntlMiddleware(routing);

/** Paths that require authentication — checked without locale prefix */
const PROTECTED_PATHS = ['/dashboard', '/admin'];

/** Paths that should redirect authenticated users away */
const AUTH_REDIRECT_PATHS = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const pathname = request.nextUrl.pathname;

  // ─── Step 1: Supabase session refresh ──────────────────────────────────
  // Carry auth cookies from the Supabase refresh through to the final response.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto the request (visible to downstream handlers)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Re-create supabaseResponse with updated request so cookies are
          // included in the final response (auth cookie refresh).
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() triggers token refresh and writes updated cookies back via setAll.
  // DO NOT call getSession() or getClaims() here — only getUser() triggers
  // the server-side refresh that keeps the cookie current.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Step 2: Route protection ───────────────────────────────────────────
  // Strip locale prefix to get the canonical path for protection checks.
  // next-intl as-needed strategy: default locale (es) has no prefix.
  const pathnameWithoutLocale = pathname.startsWith('/en/')
    ? pathname.slice(3)
    : pathname.startsWith('/en')
      ? '/'
      : pathname;

  const isProtectedPath = PROTECTED_PATHS.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + '/'),
  );

  const isAuthPath = AUTH_REDIRECT_PATHS.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + '/'),
  );

  if (isProtectedPath && !user) {
    // Redirect unauthenticated users to login, preserving the original path
    // as the ?next= param so they land there after authentication.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = pathname.startsWith('/en') ? '/en/login' : '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && user) {
    // Redirect already-authenticated users away from login/signup
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = pathname.startsWith('/en') ? '/en/dashboard' : '/dashboard';
    dashboardUrl.searchParams.delete('next');
    dashboardUrl.searchParams.delete('error');
    return NextResponse.redirect(dashboardUrl);
  }

  // ─── Step 3: next-intl middleware ───────────────────────────────────────
  const intlResponse = intlMiddleware(request);

  // ─── Step 4: Merge auth cookies + CSP headers ──────────────────────────
  // Copy Supabase auth cookies from supabaseResponse onto the intl response.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  intlResponse.headers.set('Content-Security-Policy', buildCsp(nonce));
  intlResponse.headers.set('x-nonce', nonce);

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - /_next/static  (Next.js static assets)
     *   - /_next/image   (Next.js image optimization)
     *   - /favicon.ico   (favicon)
     *   - /api           (API route handlers — NestJS proxy routes)
     *   - /auth/callback (Route Handler — handled separately, no locale)
     *
     * next-intl only processes page routes; excluding assets avoids
     * unnecessary locale detection overhead on static file requests.
     * The /api exclusion is intentional: NestJS proxy routes must not
     * be intercepted by the i18n middleware.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api|auth/callback).*)',
  ],
};
