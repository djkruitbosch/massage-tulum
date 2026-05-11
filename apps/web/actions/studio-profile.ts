'use server';

/**
 * Studio Profile server actions.
 *
 * getMyStudioProfile  — GET /api/studios/profile via NestJS BE (Bearer JWT).
 * patchMyStudioProfile — PATCH /api/studios/profile via NestJS BE (Bearer JWT).
 *
 * Each action:
 *   1. Reads the current session from the Supabase server client.
 *   2. Extracts the access_token (Bearer JWT) to forward to the NestJS API.
 *   3. Returns a typed result discriminated by success/error.
 *
 * Auth: SupabaseJwtGuard on BE verifies the forwarded Bearer token.
 * The FE never constructs the JWT — it only forwards the one Supabase
 * already established via the session cookie.
 *
 * Ref: docs/architecture/CU-869d29f1h-studio-profile.md §3 (API contract)
 * Ref: docs/architecture/CU-869d29f1h-studio-profile.md §4 (FE impact)
 * Ticket: CU-869d8cp2d
 */

import {
  studioProfileSchema,
  type StudioProfile,
  type UpdateStudioProfileInput,
} from '@massage-tulum/shared';
import { createClient } from '../utils/supabase/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// ── Result types ─────────────────────────────────────────────────────────────

export type GetProfileResult =
  | { success: true; data: StudioProfile }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

export type PatchProfileResult =
  | { success: true; data: StudioProfile }
  | {
      success: false;
      error: 'unauthenticated' | 'validation' | 'not_found' | 'server_error';
      fieldErrors?: Record<string, string[]>;
    };

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieve the current session's access token from Supabase.
 * Returns null if the user is not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated studio owner's profile from the NestJS API.
 *
 * GET /api/studios/profile
 */
export async function getMyStudioProfile(): Promise<GetProfileResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) {
    return { success: false, error: 'unauthenticated' };
  }
  if (res.status === 404) {
    return { success: false, error: 'not_found' };
  }
  if (!res.ok) {
    return { success: false, error: 'server_error' };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const parsed = studioProfileSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, error: 'server_error' };
  }

  return { success: true, data: parsed.data };
}

/**
 * Save the studio profile (all fields + all 7 hours rows).
 *
 * PATCH /api/studios/profile
 */
export async function patchMyStudioProfile(
  input: UpdateStudioProfileInput,
): Promise<PatchProfileResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) {
    return { success: false, error: 'unauthenticated' };
  }
  if (res.status === 404) {
    return { success: false, error: 'not_found' };
  }
  if (res.status === 400) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { success: false, error: 'validation' };
    }
    // NestJS validation-pipe returns { message: string[] | { field, message }[] }
    const fieldErrors = extractFieldErrors(body);
    return { success: false, error: 'validation', fieldErrors };
  }
  if (!res.ok) {
    return { success: false, error: 'server_error' };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const parsed = studioProfileSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, error: 'server_error' };
  }

  return { success: true, data: parsed.data };
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Extract field-level errors from a NestJS 400 response body.
 * NestJS ValidationPipe returns { statusCode, message, error }.
 * message can be a string[] of "field: message" pairs, or an array of objects.
 */
function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const messages = b['message'];
  if (!Array.isArray(messages)) return undefined;

  const result: Record<string, string[]> = {};
  for (const msg of messages) {
    if (typeof msg === 'string') {
      // "fieldName must be ..." — extract field name from prefix
      const parts = msg.split(' ');
      const field = parts[0] ?? 'general';
      result[field] = [...(result[field] ?? []), msg];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
