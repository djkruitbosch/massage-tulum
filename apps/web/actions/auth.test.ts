/**
 * Auth server actions tests.
 *
 * Tests:
 *   - requestMagicLink: success, rate-limit error, generic error
 *   - No PII logged (email should not appear in action return values)
 *
 * Mocks the Supabase client and next/headers.
 *
 * Note: logout and logoutAllDevices call redirect() which throws internally
 * in Next.js — testing them in isolation requires mocking redirect.
 * These are covered by the auth flow e2e test (if implemented) and manual
 * smoke testing is documented in the PR checklist.
 *
 * Ticket: CU-869d4za67
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['origin', 'http://localhost:3000']]))),
}));

// Mock next/navigation redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock the supabase server client
const mockSignInWithOtp = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../utils/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signInWithOtp: mockSignInWithOtp,
        signOut: mockSignOut,
      },
    }),
  ),
}));

describe('requestMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when Supabase signInWithOtp succeeds', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    const result = await requestMagicLink('owner@studio.com', 'en');

    expect(result).toEqual({ success: true });
  });

  it('passes locale in options.data to signInWithOtp', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    await requestMagicLink('owner@studio.com', 'es');

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@studio.com',
        options: expect.objectContaining({
          data: { locale: 'es' },
        }),
      }),
    );
  });

  it('falls back to /dashboard when no next param is provided (es)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    await requestMagicLink('owner@studio.com', 'es');

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            `/auth/callback?next=${encodeURIComponent('/dashboard')}`,
          ),
        }),
      }),
    );
  });

  it('falls back to /en/dashboard when no next param is provided (en)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    await requestMagicLink('owner@studio.com', 'en');

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            `/auth/callback?next=${encodeURIComponent('/en/dashboard')}`,
          ),
        }),
      }),
    );
  });

  it('uses a safe next path when provided', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    await requestMagicLink('owner@studio.com', 'en', '/en/studio/therapists');

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            `/auth/callback?next=${encodeURIComponent('/en/studio/therapists')}`,
          ),
        }),
      }),
    );
  });

  it.each([
    ['empty string', ''],
    ['relative path without slash', 'evil.com'],
    ['protocol-relative URL', '//evil.com'],
    ['backslash-prefixed path', '/\\evil.com'],
    ['absolute http URL', 'http://evil.com'],
  ])('rejects unsafe next param (%s) and falls back to /dashboard', async (_label, unsafe) => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    await requestMagicLink('owner@studio.com', 'es', unsafe);

    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            `/auth/callback?next=${encodeURIComponent('/dashboard')}`,
          ),
        }),
      }),
    );
  });

  it('returns too_many_requests when rate limit error is returned', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: {
        message: 'For security purposes, you can only request this after 60 seconds',
        status: 429,
      },
    });

    const { requestMagicLink } = await import('./auth');
    const result = await requestMagicLink('owner@studio.com', 'en');

    expect(result).toEqual({ success: false, error: 'too_many_requests' });
  });

  it('returns generic_error when unexpected error is returned', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: {
        message: 'Internal server error',
        status: 500,
      },
    });

    const { requestMagicLink } = await import('./auth');
    const result = await requestMagicLink('owner@studio.com', 'en');

    expect(result).toEqual({ success: false, error: 'generic_error' });
  });

  it('does not include the email in the return value (no PII leakage)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const { requestMagicLink } = await import('./auth');
    const result = await requestMagicLink('sensitive@example.com', 'en');

    // The result should not contain the email address
    expect(JSON.stringify(result)).not.toContain('sensitive@example.com');
  });
});
