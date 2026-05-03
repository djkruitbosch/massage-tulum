import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Injection token for the Supabase admin client.
 *
 * Use this token to inject the service-role Supabase client in NestJS providers:
 *   constructor(@Inject(SUPABASE_CLIENT) private supabase: SupabaseClient) {}
 *
 * Security: This client uses the service-role key and BYPASSES RLS.
 * It must NEVER be used in code paths visible to client HTTP requests
 * (i.e., never passed to the frontend or exposed via API responses).
 * See: docs/adr/0003-rls-baseline-conventions.md §Convention 4
 */
export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

/**
 * Factory for the Supabase service-role client.
 *
 * The client is created once at module init and shared as a singleton.
 * The service-role key bypasses RLS — use ONLY for server-side admin operations.
 *
 * Environment variables:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service-role key (NEVER exposed to FE)
 */
export const supabaseProvider = {
  provide: SUPABASE_CLIENT,
  useFactory: (): SupabaseClient => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
          'Copy apps/api/.env.example to apps/api/.env and fill in the values.',
      );
    }

    return createClient(url, key, {
      auth: {
        // Disable auto-refresh: this is a server-side client using service-role.
        // Service-role tokens do not expire and do not need refresh.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  },
};
