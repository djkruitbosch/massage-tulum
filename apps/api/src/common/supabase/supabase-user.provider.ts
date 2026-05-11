import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Injection token for the Supabase anon client.
 *
 * This client uses the PUBLIC anon key and is intended for user-scoped
 * requests. RLS is enforced based on the JWT supplied per-request.
 *
 * Use this token (not SUPABASE_CLIENT) for all studio owner API operations
 * so that Postgres RLS policies govern data access.
 *
 * Security model:
 *   - The anon client is scoped to `authenticated` role when a valid JWT is
 *     passed via supabase.auth.setSession() or per-request headers.
 *   - RLS policies on studio_hours, studios, etc. restrict data to the
 *     authenticated user's own studio (via studio_profiles join).
 *
 * See: docs/adr/0003-rls-baseline-conventions.md §Convention 4
 */
export const SUPABASE_USER_CLIENT = 'SUPABASE_USER_CLIENT';

/**
 * Factory for the Supabase anon client (user-scoped, RLS-enforced).
 *
 * Environment variables:
 *   SUPABASE_URL      — Supabase project URL
 *   SUPABASE_ANON_KEY — Public anon key (safe to expose to front-end)
 */
export const supabaseUserProvider = {
  provide: SUPABASE_USER_CLIENT,
  useFactory: (): SupabaseClient => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_ANON_KEY'];

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY must be set. ' +
          'Copy apps/api/.env.example to apps/api/.env and fill in the values.',
      );
    }

    return createClient(url, key, {
      auth: {
        // Server-side: no session persistence or auto-refresh.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  },
};
