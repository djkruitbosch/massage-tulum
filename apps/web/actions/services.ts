'use server';

/**
 * Service catalog server actions.
 *
 * All 7 actions call the NestJS service-catalog endpoints under /api/studios/services.
 * Each action:
 *   1. Reads the current Supabase session to extract the Bearer JWT.
 *   2. Forwards the JWT in the Authorization header to NestJS (SupabaseJwtGuard).
 *   3. Returns a typed discriminated-union result.
 *
 * SECURITY: Never log PII — service names, descriptions, categories must not
 * appear in any console output or error messages.
 *
 * Ref: docs/architecture/CU-869d29f21-service-catalog.md §4
 * Ticket: CU-869d29f21
 */

import {
  serviceResponseSchema,
  createServiceSchema,
  updateServiceSchema,
  futureBookingsCountSchema,
  type ServiceResponse,
  type CreateServiceInput,
  type UpdateServiceInput,
} from '@massage-tulum/shared';
import { z } from 'zod';
import { createClient } from '../utils/supabase/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// ── Result types ─────────────────────────────────────────────────────────────

export type ServiceResult =
  | { success: true; data: ServiceResponse }
  | {
      success: false;
      error: 'unauthenticated' | 'not_found' | 'conflict' | 'validation' | 'server_error';
      fieldErrors?: Record<string, string[]>;
    };

export type ServicesListResult =
  | { success: true; data: ServiceResponse[] }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

export type CategoriesResult =
  | { success: true; data: string[] }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

export type FutureBookingsCountResult =
  | { success: true; data: { futureBookingsCount: number } }
  | { success: false; error: 'unauthenticated' | 'not_found' | 'server_error' };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function parseService(json: unknown): ServiceResponse | null {
  const parsed = serviceResponseSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function parseServiceList(json: unknown): ServiceResponse[] | null {
  const parsed = z.array(serviceResponseSchema).safeParse(json);
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
 * GET /api/studios/services?status=...
 *
 * Returns services filtered by status. Default is 'active'.
 */
export async function listServices(
  status: 'active' | 'inactive' | 'all' = 'active',
): Promise<ServicesListResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services?status=${encodeURIComponent(status)}`, {
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

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseServiceList(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * GET /api/studios/services/categories
 *
 * Returns the distinct non-null category values for the authenticated studio.
 */
export async function getCategories(): Promise<CategoriesResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services/categories`, {
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

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const parsed = z.array(z.string()).safeParse(json);
  if (!parsed.success) return { success: false, error: 'server_error' };

  return { success: true, data: parsed.data };
}

/**
 * POST /api/studios/services
 */
export async function createService(input: CreateServiceInput): Promise<ServiceResult> {
  // Validate input client-side before sending
  const validated = createServiceSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: 'validation' };
  }

  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  // Normalize empty category to null
  const payload = {
    ...validated.data,
    category: validated.data.category === '' ? null : (validated.data.category ?? null),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 422 || res.status === 400) {
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

  const data = parseService(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * PATCH /api/studios/services/:id
 */
export async function updateService(id: string, input: UpdateServiceInput): Promise<ServiceResult> {
  const validated = updateServiceSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: 'validation' };
  }

  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  // Normalize empty category to null
  const payload = {
    ...validated.data,
    ...(validated.data.category !== undefined && {
      category: validated.data.category === '' ? null : (validated.data.category ?? null),
    }),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 422 || res.status === 400) {
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

  const data = parseService(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * GET /api/studios/services/:id/deactivate-preview
 *
 * Called when the user triggers the Deactivate action — at dialog-open time.
 * Returns futureBookingsCount (always 0 in v1; real count when bookings land).
 */
export async function getFutureBookingsCount(id: string): Promise<FutureBookingsCountResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/api/studios/services/${encodeURIComponent(id)}/deactivate-preview`,
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

  const parsed = futureBookingsCountSchema.safeParse(json);
  if (!parsed.success) {
    // Fallback: accept futureBookingCount (singular) which the arch doc uses
    const fallback = z.object({ futureBookingCount: z.number().int().min(0) }).safeParse(json);
    if (fallback.success) {
      return { success: true, data: { futureBookingsCount: fallback.data.futureBookingCount } };
    }
    return { success: false, error: 'server_error' };
  }

  return { success: true, data: parsed.data };
}

/**
 * POST /api/studios/services/:id/deactivate
 * (maps to PATCH /api/studios/services/:id/status with { status: 'inactive' })
 */
export async function deactivateService(id: string): Promise<ServiceResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'inactive' }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 409) return { success: false, error: 'conflict' };
  if (res.status === 400) return { success: false, error: 'validation' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseService(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}

/**
 * POST /api/studios/services/:id/reactivate
 * (maps to PATCH /api/studios/services/:id/status with { status: 'active' })
 */
export async function reactivateService(id: string): Promise<ServiceResult> {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: 'unauthenticated' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/studios/services/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'active' }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'server_error' };
  }

  if (res.status === 401) return { success: false, error: 'unauthenticated' };
  if (res.status === 404) return { success: false, error: 'not_found' };
  if (res.status === 409) return { success: false, error: 'conflict' };
  if (res.status === 400) return { success: false, error: 'validation' };
  if (!res.ok) return { success: false, error: 'server_error' };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { success: false, error: 'server_error' };
  }

  const data = parseService(json);
  if (!data) return { success: false, error: 'server_error' };

  return { success: true, data };
}
