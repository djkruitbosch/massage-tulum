/**
 * Supabase browser client factory.
 *
 * Used in Client Components only. Creates a browser-side Supabase client
 * that manages session via localStorage/cookies.
 *
 * Ref: docs/research/2026-05-03-studio-owner-auth.md §R5
 * ADR: docs/adr/0007-supabase-auth-magic-link.md
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
