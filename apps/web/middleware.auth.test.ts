/**
 * Tests for the auth-aware middleware.
 *
 * Covers:
 *   - Unauthenticated user accessing /dashboard → redirect to /login?next=/dashboard
 *   - Unauthenticated user accessing /en/dashboard → redirect to /en/login?next=/en/dashboard
 *   - Authenticated user accessing /login → redirect to /dashboard
 *   - Non-protected route passes through normally
 *   - CSP + x-nonce headers still set on all responses
 *
 * Mocks:
 *   - @supabase/ssr createServerClient → controls the user returned by getUser()
 *   - next-intl/middleware → returns a basic NextResponse
 *   - ./i18n/routing → empty routing config (not the concern of this test)
 *
 * Ticket: CU-869d4za67
 */
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Mock @supabase/ssr before importing middleware
const mockGetUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock next-intl/middleware
vi.mock('next-intl/middleware', () => ({
  default: () => (_request: NextRequest) => new NextResponse(null, { status: 200 }),
}));

// Mock i18n/routing
vi.mock('./i18n/routing', () => ({
  routing: {},
}));

// Dynamic import after mocks
const { middleware } = await import('./middleware');

function makeRequest(path: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'));
}

describe('middleware — route protection', () => {
  it('redirects unauthenticated user from /dashboard to /login?next=/dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/dashboard'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fdashboard');
  });

  it('redirects unauthenticated user from /en/dashboard to /en/login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/en/dashboard'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/en/login');
  });

  it('redirects authenticated user from /login to /dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    });
    const response = await middleware(makeRequest('/login'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/dashboard');
  });

  it('redirects authenticated user from /en/login to /en/dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    });
    const response = await middleware(makeRequest('/en/login'));
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/en/dashboard');
  });

  it('passes through non-protected route for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/'));
    // No redirect — intl middleware handles it (returns 200)
    expect(response.status).toBe(200);
  });

  it('passes through protected route for authenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    });
    const response = await middleware(makeRequest('/dashboard'));
    // Authenticated user reaches the intl middleware (returns 200)
    expect(response.status).toBe(200);
  });
});

describe('middleware — CSP headers (with auth)', () => {
  it('sets Content-Security-Policy on normal responses', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
  });

  it('sets x-nonce on normal responses', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/'));
    expect(response.headers.get('x-nonce')).not.toBeNull();
  });

  it('CSP nonce matches x-nonce value', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/'));
    const nonce = response.headers.get('x-nonce');
    const csp = response.headers.get('Content-Security-Policy');
    expect(nonce).not.toBeNull();
    expect(csp).toContain(`'nonce-${nonce}'`);
  });
});
