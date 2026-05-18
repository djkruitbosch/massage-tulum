/**
 * Admin server actions tests.
 *
 * Covers approvePendingStudio, rejectPendingStudio, fetchPendingStudios:
 *   - happy path returns success
 *   - missing session returns 'unauthorized' without calling fetch
 *   - 401/403 → 'unauthorized'
 *   - 404 → 'not_found' (approve/reject) or 'unauthorized' (fetch, per ADR-0008 §3
 *     where the admin guard returns 404 for non-admins as an obscurity measure)
 *   - 409 → 'conflict' (approve/reject only)
 *   - 5xx → 'generic_error'
 *   - fetch exception → 'generic_error'
 *   - Bearer token + URL + body shape are forwarded as expected
 *
 * Mocks: Supabase server client, global fetch.
 *
 * Ticket: CU-869d4za07 (matches the actions' originating ticket)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock next/headers (required by createClient from @supabase/ssr)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
  ),
}));

// Mock the Supabase server client
const mockGetSession = vi.fn();

vi.mock('../utils/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getSession: mockGetSession,
      },
    }),
  ),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_TOKEN = 'test-admin-token-xyz789';
const PENDING_ID = '7a6b5c4d-3e2f-1a0b-9c8d-7e6f5a4b3c2d';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: MOCK_TOKEN } },
  });
});

describe('approvePendingStudio', () => {
  it('returns success on 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(true);
  });

  it('returns unauthorized when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns unauthorized on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns unauthorized on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns not_found on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });

  it('returns conflict on 409 (already approved/rejected)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('conflict');
    }
  });

  it('returns generic_error on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('returns generic_error when fetch throws (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { approvePendingStudio } = await import('./admin');
    const result = await approvePendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('POSTs to /api/admin/pending-studios/:id/approve with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { approvePendingStudio } = await import('./admin');
    await approvePendingStudio(PENDING_ID);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/admin/pending-studios/${PENDING_ID}/approve`);
    expect(options?.method).toBe('POST');
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${MOCK_TOKEN}`,
    );
    expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

describe('rejectPendingStudio', () => {
  it('returns success on 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(true);
  });

  it('returns unauthorized when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID, 'duplicate');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns unauthorized on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns unauthorized on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns not_found on 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });

  it('returns conflict on 409 (already processed)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('conflict');
    }
  });

  it('returns generic_error on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('returns generic_error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { rejectPendingStudio } = await import('./admin');
    const result = await rejectPendingStudio(PENDING_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('sends reason in JSON body when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { rejectPendingStudio } = await import('./admin');
    await rejectPendingStudio(PENDING_ID, 'incomplete application');

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/admin/pending-studios/${PENDING_ID}/reject`);
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({ reason: 'incomplete application' });
  });

  it('sends reason: null when no reason argument is passed', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { rejectPendingStudio } = await import('./admin');
    await rejectPendingStudio(PENDING_ID);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options?.body as string)).toEqual({ reason: null });
  });

  it('coerces undefined reason to null in body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { rejectPendingStudio } = await import('./admin');
    await rejectPendingStudio(PENDING_ID, null);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options?.body as string)).toEqual({ reason: null });
  });

  it('forwards Bearer token in Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { rejectPendingStudio } = await import('./admin');
    await rejectPendingStudio(PENDING_ID);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${MOCK_TOKEN}`,
    );
  });
});

describe('fetchPendingStudios', () => {
  const MOCK_LIST = {
    data: [
      {
        id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        email: 'owner1@studio.com',
        studioName: 'Aldea Zama Wellness',
        contactPhone: '+529841230001',
        description: 'Two-therapist studio in Aldea Zama.',
        locale: 'es',
        status: 'pending',
        submittedAt: '2026-05-10T12:00:00.000Z',
      },
      {
        id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
        email: 'owner2@studio.com',
        studioName: 'Tulum Beach Spa',
        contactPhone: null,
        description: 'Beachfront spa, single therapist.',
        locale: 'en',
        status: 'pending',
        submittedAt: '2026-05-11T09:30:00.000Z',
      },
    ],
    total: 2,
    page: 1,
    limit: 100,
  };

  it('returns success with parsed data on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_LIST,
    });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.studioName).toBe('Aldea Zama Wellness');
      expect(result.total).toBe(2);
    }
  });

  it('returns unauthorized when no session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns unauthorized on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns unauthorized on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns unauthorized on 404 (non-admin obscurity per ADR-0008)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthorized');
    }
  });

  it('returns generic_error on 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('returns generic_error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { fetchPendingStudios } = await import('./admin');
    const result = await fetchPendingStudios();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('generic_error');
    }
  });

  it('GETs with status=pending&limit=100 query and Bearer token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_LIST,
    });

    const { fetchPendingStudios } = await import('./admin');
    await fetchPendingStudios();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/admin/pending-studios');
    expect(url).toContain('status=pending');
    expect(url).toContain('limit=100');
    expect(options?.method).toBe('GET');
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${MOCK_TOKEN}`,
    );
  });
});
