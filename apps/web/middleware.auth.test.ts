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

// ── 308 canonical-path enforcement (AC-5, ADR-0010) ─────────────────────────
//
// These tests verify the 308 short-circuit that intercepts non-canonical
// privacy paths before next-intl runs. next-intl defaults to 307; the spec
// requires 308 (permanent redirect) for correct SEO crawl-budget signaling.
//
// Ticket: CU-869d8202d
describe('middleware — 308 privacy canonical redirects', () => {
  // /privacy-policy (en slug without locale prefix) → /aviso-de-privacidad
  it('redirects /privacy-policy to /aviso-de-privacidad with 308', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/privacy-policy'));
    expect(response.status).toBe(308);
    const location = response.headers.get('location');
    expect(location).toContain('/aviso-de-privacidad');
  });

  it('/privacy-policy redirect does not go to /privacy-policy (no loop)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/privacy-policy'));
    expect(response.headers.get('location')).not.toContain('/privacy-policy');
  });

  // /en/aviso-de-privacidad (es slug under en prefix) → /en/privacy-policy
  it('redirects /en/aviso-de-privacidad to /en/privacy-policy with 308', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/en/aviso-de-privacidad'));
    expect(response.status).toBe(308);
    const location = response.headers.get('location');
    expect(location).toContain('/en/privacy-policy');
  });

  it('/en/aviso-de-privacidad redirect does not contain /aviso-de-privacidad', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/en/aviso-de-privacidad'));
    const location = response.headers.get('location') ?? '';
    // Must redirect to /en/privacy-policy, not the Spanish slug
    expect(location).toContain('/en/privacy-policy');
    expect(location).not.toContain('/aviso-de-privacidad');
  });

  // /es/aviso-de-privacidad (superfluous default-locale prefix) → /aviso-de-privacidad
  it('redirects /es/aviso-de-privacidad to /aviso-de-privacidad with 308', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/es/aviso-de-privacidad'));
    expect(response.status).toBe(308);
    const location = response.headers.get('location');
    expect(location).toContain('/aviso-de-privacidad');
    expect(location).not.toContain('/es/');
  });

  // Canonical paths must NOT be caught by the 308 short-circuit
  it('does not redirect canonical /aviso-de-privacidad (es) — returns 200', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/aviso-de-privacidad'));
    // next-intl mock returns 200; the 308 map must not intercept this path
    expect(response.status).toBe(200);
  });

  it('does not redirect /en/privacy-policy (en canonical) — returns 200', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/en/privacy-policy'));
    expect(response.status).toBe(200);
  });

  // 308 responses must still carry CSP + nonce headers
  it('308 redirect response includes CSP header', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/privacy-policy'));
    expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
  });

  it('308 redirect response includes x-nonce header', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await middleware(makeRequest('/privacy-policy'));
    expect(response.headers.get('x-nonce')).not.toBeNull();
  });
});
