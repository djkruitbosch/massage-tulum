'use server';

/**
 * Auth server actions.
 *
 * - requestMagicLink: sends a magic-link email via Supabase Auth.
 *   Passes locale in options.data so the bilingual Go-template in
 *   supabase/templates/magic-link.html can branch by {{ .Data.locale }}.
 *   Ref: docs/adr/0009-bilingual-supabase-email-templates.md
 *
 * - logout: signs out of the current device (local scope).
 *
 * - logoutAllDevices: signs out of all devices (global scope).
 *   Revokes all refresh tokens in Supabase DB. Access tokens on other
 *   devices remain valid up to 1 hour post-revocation (JWT expiry).
 *   Ref: docs/research/2026-05-03-studio-owner-auth.md §R4
 *
 * All logout actions use createClient (server) so @supabase/ssr writes
 * cleared session cookies onto the response before redirect.
 *
 * Ticket: CU-869d4za67
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../utils/supabase/server';

export type MagicLinkResult =
  | { success: true }
  | { success: false; error: 'too_many_requests' | 'generic_error' };

/**
 * Returns `next` if it is a safe same-origin path, else `null`.
 * Rejects protocol-relative URLs (`//evil.com`) and backslash tricks
 * (`/\evil.com`) that some browsers parse as cross-origin.
 */
function sanitizeNextPath(next: string | undefined): string | null {
  if (typeof next !== 'string' || next.length === 0) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  if (next.startsWith('/\\')) return null;
  return next;
}

/**
 * Request a magic-link for the given email.
 *
 * @param email - The studio owner's email address.
 * @param locale - The current UI locale ('es' | 'en') — passed to the email
 *                 template via options.data so it can render in the right language.
 * @param next  - Optional same-origin path to redirect to after sign-in
 *                 (e.g. `/en/studio/therapists`). Set by middleware route
 *                 protection on the `?next=` query param of the login URL.
 *                 Falls back to `/dashboard` (locale-prefixed) when missing
 *                 or unsafe.
 */
export async function requestMagicLink(
  email: string,
  locale: string,
  next?: string,
): Promise<MagicLinkResult> {
  const headersList = await headers();
  const origin =
    (headersList.get('origin') ?? headersList.get('x-forwarded-proto'))
      ? `${headersList.get('x-forwarded-proto')}://${headersList.get('host')}`
      : 'http://localhost:3000';

  // emailRedirectTo always points to /auth/callback (no locale prefix).
  // The auth callback handler reads the `next` param for the final destination.
  // Supabase constructs the magic-link URL using this as the callback base.
  const safeNext = sanitizeNextPath(next);
  const destination = safeNext ?? `${locale === 'en' ? '/en' : ''}/dashboard`;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(destination)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      // Pass locale in data so the Go-template can branch by {{ .Data.locale }}
      // per ADR-0009 bilingual email template pattern.
      data: { locale },
    },
  });

  if (error) {
    // Supabase rate-limit error: message contains "For security purposes" or
    // status code 429. Map to a user-facing key.
    if (
      error.message?.toLowerCase().includes('security purposes') ||
      error.message?.toLowerCase().includes('rate limit') ||
      error.status === 429
    ) {
      return { success: false, error: 'too_many_requests' };
    }
    return { success: false, error: 'generic_error' };
  }

  return { success: true };
}

/**
 * Log out of the current device only (local scope).
 * Revokes the current session's refresh token.
 * Clears auth cookies via @supabase/ssr setAll handler.
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}

/**
 * Log out of all devices (global scope).
 * Revokes ALL refresh tokens for this user in the Supabase DB.
 * Access tokens on other devices remain valid up to 1 hour post-revocation
 * due to stateless JWT design — acceptable for this app's security posture.
 */
export async function logoutAllDevices(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/login');
}
