/**
 * Auth callback Route Handler.
 *
 * Handles magic-link OTP verification. This route is NOT locale-prefixed —
 * it lives at /auth/callback and handles both locales by reading the `next`
 * query parameter (which contains the locale-prefixed destination path).
 *
 * Supabase constructs the magic-link URL as:
 *   <site_url>/auth/callback?token_hash=...&type=email&next=<redirect_path>
 *
 * The `next` param is set from the `emailRedirectTo` passed in signInWithOtp.
 * We always pass emailRedirectTo as `<origin>/auth/callback` — the `next`
 * param carries the final destination (e.g. /dashboard or /en/dashboard).
 *
 * Error cases — all redirect to /login?error=<code>:
 *   - link_expired: OTP older than 1h (otp_expiry=3600 per ADR-0007 split-expiry)
 *   - invalid_link: tampered/missing token or invalid type
 *   - network_error: unexpected error during verifyOtp
 *
 * Ref: docs/research/2026-05-03-studio-owner-auth.md §R5
 * Ref: docs/adr/0007-supabase-auth-magic-link.md
 * Ticket: CU-869d4za67
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // next contains the final destination (locale-prefixed, e.g. /dashboard or /en/dashboard)
  const next = searchParams.get('next') ?? '/dashboard';

  // Determine locale from the `next` param for error redirects
  const localePrefix = next.startsWith('/en') ? '/en' : '';
  const loginErrorBase = `${origin}${localePrefix}/login`;

  if (!token_hash || !type) {
    return NextResponse.redirect(`${loginErrorBase}?error=invalid_link`);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
      // Expired OTP and already-used OTP both present as the same user-facing message
      const errorCode =
        error.message?.toLowerCase().includes('expired') ||
        error.message?.toLowerCase().includes('already used') ||
        error.message?.toLowerCase().includes('otp')
          ? 'link_expired'
          : 'invalid_link';

      return NextResponse.redirect(`${loginErrorBase}?error=${errorCode}`);
    }

    // Session established — redirect to the destination (locale-prefixed)
    const destinationPath = next.startsWith('/') ? next : `/${next}`;
    return NextResponse.redirect(`${origin}${destinationPath}`);
  } catch {
    // Unexpected error (network, etc.)
    return NextResponse.redirect(`${loginErrorBase}?error=network_error`);
  }
}
