'use server';

/**
 * Admin server actions for pending studio management.
 *
 * Both actions require an authenticated admin user. The admin JWT is read from
 * Supabase cookies and sent as Bearer token to the NestJS API. The NestJS
 * AdminGuard validates the JWT and checks ADMIN_EMAILS env var (ADR-0008 §3).
 *
 * AC-22: These actions are only reachable from admin-protected pages. The page
 * server component performs a 404 redirect for non-admin users before rendering,
 * so these actions are an additional layer, not the primary gate.
 *
 * AC-23: approvePendingStudio — NestJS atomically creates studios + studio_profiles,
 * marks pending row approved, generates magic-link, sends welcome email via Brevo.
 *
 * AC-24: rejectPendingStudio — NestJS updates pending_studios.status = 'rejected'
 * with optional reason. No email sent (silent rejection in v1 per spec §11).
 *
 * Ref: docs/adr/0008-studio-onboarding-self-signup.md §3 (admin auth mechanism)
 * Ref: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 * Ticket: CU-869d4za07
 */

import { createClient } from '../utils/supabase/server';

export type AdminActionResult =
  | { success: true }
  | { success: false; error: 'unauthorized' | 'not_found' | 'conflict' | 'generic_error' };

/**
 * Approve a pending studio application.
 *
 * Sends JWT from the admin's Supabase session to the NestJS admin guard.
 * On success, the NestJS service atomically creates the studio, links the
 * auth user, and dispatches a bilingual welcome email.
 */
export async function approvePendingStudio(pendingStudioId: string): Promise<AdminActionResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'unauthorized' };
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/admin/pending-studios/${pendingStudioId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'generic_error' };
  }

  if (response.status === 401 || response.status === 403) {
    return { success: false, error: 'unauthorized' };
  }
  if (response.status === 404) {
    return { success: false, error: 'not_found' };
  }
  if (response.status === 409) {
    return { success: false, error: 'conflict' };
  }
  if (response.ok) {
    return { success: true };
  }

  return { success: false, error: 'generic_error' };
}

/**
 * Reject a pending studio application with an optional reason.
 *
 * No email is sent to the applicant (silent rejection in v1 per spec §11).
 */
export async function rejectPendingStudio(
  pendingStudioId: string,
  reason?: string | null,
): Promise<AdminActionResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'unauthorized' };
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/admin/pending-studios/${pendingStudioId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ reason: reason ?? null }),
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'generic_error' };
  }

  if (response.status === 401 || response.status === 403) {
    return { success: false, error: 'unauthorized' };
  }
  if (response.status === 404) {
    return { success: false, error: 'not_found' };
  }
  if (response.status === 409) {
    return { success: false, error: 'conflict' };
  }
  if (response.ok) {
    return { success: true };
  }

  return { success: false, error: 'generic_error' };
}

/**
 * Fetch pending studios from the NestJS admin API.
 *
 * Returns the list of pending studios or an empty array on error.
 * Used server-side in the admin page component.
 */
export async function fetchPendingStudios(): Promise<
  | {
      success: true;
      data: Array<{
        id: string;
        email: string;
        studioName: string;
        contactPhone: string | null;
        description: string;
        locale: string;
        status: string;
        submittedAt: string;
      }>;
      total: number;
    }
  | { success: false; error: 'unauthorized' | 'generic_error' }
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'unauthorized' };
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/admin/pending-studios?status=pending&limit=100`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: 'no-store',
    });
  } catch {
    return { success: false, error: 'generic_error' };
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { success: false, error: 'unauthorized' };
  }

  if (!response.ok) {
    return { success: false, error: 'generic_error' };
  }

  const json = (await response.json()) as {
    data: Array<{
      id: string;
      email: string;
      studioName: string;
      contactPhone: string | null;
      description: string;
      locale: string;
      status: string;
      submittedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  };

  return { success: true, data: json.data, total: json.total };
}
