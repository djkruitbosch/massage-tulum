'use server';

/**
 * Signup server action.
 *
 * Calls the NestJS POST /api/studios/signup endpoint with the studio
 * registration data. The backend handles:
 *   - IP-based rate limiting (3 req / 60s via @nestjs/throttler)
 *   - Duplicate email de-duplication (silent, no enumeration — AC-21)
 *   - Inserting into pending_studios via service-role Supabase client
 *
 * On any 2xx or duplicate-handled response, returns { success: true }.
 * On 429 (rate limit) returns { success: false, error: 'rate_limit' }.
 * On any other error returns { success: false, error: 'generic_error' }.
 *
 * The locale param is passed in the request body so the admin approval flow
 * can send a bilingual welcome email in the studio owner's preferred language.
 * GATE 2 amendment: locale is derived from URL prefix and passed in POST body.
 *
 * Ref: docs/adr/0008-studio-onboarding-self-signup.md §1
 * Ref: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 * Ticket: CU-869d4za07
 */

export type SignupResult =
  | { success: true }
  | { success: false; error: 'rate_limit' | 'generic_error' };

interface SignupPayload {
  email: string;
  studioName: string;
  contactPhone?: string | null;
  description: string;
  locale: string;
}

/**
 * Submit a studio registration application to the NestJS API.
 *
 * AC-20: Calls POST /api/studios/signup — creates a pending_studios row.
 * AC-21: Duplicate emails receive the same success response (BE de-dups silently).
 */
export async function submitSignup(payload: SignupPayload): Promise<SignupResult> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/studios/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // No cache — this is a mutation
      cache: 'no-store',
    });
  } catch {
    // Network error (fetch throws on connection failure)
    return { success: false, error: 'generic_error' };
  }

  if (response.status === 429) {
    return { success: false, error: 'rate_limit' };
  }

  // BE returns 201 for both new and duplicate submissions (AC-21 — no enumeration).
  // Any 2xx is treated as success.
  if (response.ok) {
    return { success: true };
  }

  return { success: false, error: 'generic_error' };
}
