/**
 * Supabase server client factory.
 *
 * Used in Server Components, Route Handlers, and Server Actions.
 * Uses @supabase/ssr createServerClient with async cookies() for Next.js 15.
 *
 * The setAll handler silently ignores write errors in Server Components
 * (read-only context); session writes are handled by middleware and Route
 * Handlers where the cookie store is writable.
 *
 * Ref: docs/research/2026-05-03-studio-owner-auth.md §R5
 * ADR: docs/adr/0007-supabase-auth-magic-link.md
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // Next.js 15: cookies() is async

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Read-only in Server Components — middleware handles session writes.
            // This catch is intentional: Server Components cannot set cookies but
            // the @supabase/ssr client may attempt to refresh the session.
          }
        },
      },
    },
  );
}
