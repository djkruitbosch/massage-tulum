'use server';

/**
 * Therapist server actions.
 *
 * All 6 actions call the NestJS therapist endpoints under /api/studios/therapists.
 * Each action:
 *   1. Reads the current Supabase session to extract the Bearer JWT.
 *   2. Forwards the JWT in the Authorization header to NestJS (SupabaseJwtGuard).
 *   3. Returns a typed discriminated-union result.
 *
 * SECURITY: Never log PII (therapist name, phone, email).
 *
 * Ref: docs/architecture/CU-869d29f1p-therapist-roster.md §4
 * Ticket: CU-869d8k3yv
 */

import {
  therapistSchema,
  type CreateTherapistInput,
  type Therapist,
  type UpdateTherapistInput,
} from '@massage-tulum/shared';
import { z } from 'zod';
import { createClient } from '../utils/supabase/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// ── Result types ─────────────────────────────────────────────────────────────

export type TherapistResult =
  | { success: true; data: Therapist }
  | {
      success: false;
      error: 'unauthenticated' | 'not_found' | 'validation' | 'server_error';
      fieldErrors?: Record<string, string[]>;
    };

export type TherapistsListResult =
  | { success: true; data: Therapist[] }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

export type UploadPhotoResult =
  | { success: true; data: Therapist }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'validation' | 'server_error' };

export type RemovePhotoResult =
  | { success: true; data: Therapist }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function parseTherapist(json: unknown): Therapist | null {
  const parsed = therapistSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function parseTherapistList(json: unknown): Therapist[] | null {
  const parsed = z.array(therapistSchema).safeParse(json);
  return parsed.success ? parsed.data : null;
}

function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const messages = b['message'];
  if (!Array.isArray(messages)) return undefined;

  const result: Record<string, string[]> = {};
  for (const msg of messages) {
    if (typeof msg === 'string') {
      const parts = msg.split(' ');
      const field = parts[0] ?? 'general';
      result[field] = [...(result[field] ?? []), msg];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * GET /api/studios/therapists?status=...
 *
 * Returns therapists filtered by status.
 * Default in the API is 'all' but the FE defaults to 'active' (URL param).
 */
export async function getMyTherapists(
  filter: 'active' | 'inactive' | 'all' = 'active',
): Promise<TherapistsListResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/api/studios/therapists?status=${encodeURIComponent(filter)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapistList(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * POST /api/studios/therapists
 */
export async function createTherapist(input: CreateTherapistInput): Promise<TherapistResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/therapists`, {
      method: 'POST',
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

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 400) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { success: false, error: 'validation' };
    }
    return { success: false, error: 'validation', fieldErrors: extractFieldErrors(body) };
  }
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapist(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * PATCH /api/studios/therapists/:id
 */
export async function updateTherapist(
  id: string,
  input: UpdateTherapistInput,
): Promise<TherapistResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/therapists/${encodeURIComponent(id)}`, {
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

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 400) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { success: false, error: 'validation' };
    }
    return { success: false, error: 'validation', fieldErrors: extractFieldErrors(body) };
  }
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapist(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * PATCH /api/studios/therapists/:id/status
 */
export async function setTherapistStatus(
  id: string,
  status: 'active' | 'inactive',
): Promise<TherapistResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/therapists/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 400) return { success: false, error: 'validation' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapist(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * POST /api/studios/therapists/:id/photo  (multipart/form-data)
 *
 * Forwards the file as multipart to NestJS. The FE client component sends
 * a FormData object; this action reconstructs a FormData for the fetch call
 * because Server Actions serialize FormData transparently.
 */
export async function uploadTherapistPhoto(id: string, file: File): Promise<UploadPhotoResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  const formData = new FormData();
  formData.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/therapists/${encodeURIComponent(id)}/photo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type — fetch sets it automatically with boundary for multipart
      },
      body: formData,
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 400) return { success: false, error: 'validation' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapist(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * DELETE /api/studios/therapists/:id/photo
 */
export async function removeTherapistPhoto(id: string): Promise<RemovePhotoResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/therapists/${encodeURIComponent(id)}/photo`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseTherapist(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}
