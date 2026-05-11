/**
 * Studio Profile server actions tests.
 *
 * Tests:
 *   - getMyStudioProfile: success, 401 unauthenticated, 404 not_found, network error
 *   - patchMyStudioProfile: success, 400 validation, 401 unauthenticated, network error
 *   - Session token is forwarded in Authorization header
 *
 * Mocks: Supabase server client, global fetch.
 *
 * Ticket: CU-869d8cp2d
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

// Stable test data
const MOCK_TOKEN = 'test-access-token-abc123';
const MOCK_PROFILE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Tulum Healing Studio',
  address: null,
  phone: '+529841234567',
  email: 'hello@tulum.com',
  description: 'A tranquil place for healing massage.',
  hours: Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    isOpen: i < 5, // Mon–Fri open
    openTime: i < 5 ? '09:00' : null,
    closeTime: i < 5 ? '18:00' : null,
  })),
  updatedAt: '2026-05-03T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: MOCK_TOKEN } },
  });
});

describe('getMyStudioProfile', () => {
  it('returns success with parsed profile on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_PROFILE,
    });

    const { getMyStudioProfile } = await import('./studio-profile');
    const result = await getMyStudioProfile();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Tulum Healing Studio');
      expect(result.data.hours).toHaveLength(7);
    }
  });

  it('forwards Bearer token in Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_PROFILE,
    });

    const { getMyStudioProfile } = await import('./studio-profile');
    await getMyStudioProfile();

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options?.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${MOCK_TOKEN}`,
    );
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
    });

    const { getMyStudioProfile } = await import('./studio-profile');
    const result = await getMyStudioProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthenticated');
    }
    // Should not call fetch when no token
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns unauthenticated on 401 from API', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { getMyStudioProfile } = await import('./studio-profile');
    const result = await getMyStudioProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthenticated');
    }
  });

  it('returns not_found on 404 from API', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { getMyStudioProfile } = await import('./studio-profile');
    const result = await getMyStudioProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });

  it('returns server_error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { getMyStudioProfile } = await import('./studio-profile');
    const result = await getMyStudioProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('server_error');
    }
  });
});

describe('patchMyStudioProfile', () => {
  const PATCH_INPUT = {
    name: 'Tulum Healing Studio',
    phone: '+529841234567',
    email: null,
    description: null,
    hours: Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      isOpen: false,
      openTime: null,
      closeTime: null,
    })),
  };

  it('returns success with updated profile on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_PROFILE,
    });

    const { patchMyStudioProfile } = await import('./studio-profile');
    const result = await patchMyStudioProfile(PATCH_INPUT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Tulum Healing Studio');
    }
  });

  it('sends PATCH method with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MOCK_PROFILE,
    });

    const { patchMyStudioProfile } = await import('./studio-profile');
    await patchMyStudioProfile(PATCH_INPUT);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options?.method).toBe('PATCH');
    expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(options?.body as string)).toMatchObject({ name: 'Tulum Healing Studio' });
  });

  it('returns validation error on 400', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        statusCode: 400,
        message: ['name must not be empty'],
        error: 'Bad Request',
      }),
    });

    const { patchMyStudioProfile } = await import('./studio-profile');
    const result = await patchMyStudioProfile({ ...PATCH_INPUT, name: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
  });

  it('returns unauthenticated when no session token', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { patchMyStudioProfile } = await import('./studio-profile');
    const result = await patchMyStudioProfile(PATCH_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unauthenticated');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
