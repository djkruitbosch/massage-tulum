/**
 * Tests for the combined CSP + next-intl middleware.
 *
 * Strategy: mock next-intl/middleware (it returns a NextResponse that needs
 * the Next.js runtime) and ./i18n/routing (it has no testable logic here).
 * The assertions focus entirely on the CSP nonce behaviour that this file
 * is responsible for — i.e. that every response gets the right headers.
 *
 * Ticket: CU-869d29n0x (FE-3)
 */
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Mock next-intl/middleware before importing middleware.ts so the module
// resolver picks up the mock.
vi.mock('next-intl/middleware', () => ({
  default: () => (_request: NextRequest) => new NextResponse(null, { status: 200 }),
}));

// Mock i18n/routing — it has no relevance to the CSP logic under test.
vi.mock('./i18n/routing', () => ({
  routing: {},
}));

// Dynamic import so the mocks above are applied before module evaluation.
const { middleware } = await import('./middleware');

function makeRequest(path = '/') {
  return new NextRequest(new URL(path, 'http://localhost:3000'));
}

describe('middleware — CSP nonce headers', () => {
  it('sets a Content-Security-Policy header on the response', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).not.toBeNull();
  });

  it('sets an x-nonce header on the response', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('x-nonce')).not.toBeNull();
  });

  it('CSP header contains the nonce value from x-nonce', () => {
    const response = middleware(makeRequest('/'));
    const nonce = response.headers.get('x-nonce');
    const csp = response.headers.get('Content-Security-Policy');
    expect(nonce).not.toBeNull();
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('CSP header contains default-src self', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).toContain(`default-src 'self'`);
  });

  it('CSP header contains strict-dynamic in script-src', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).toContain(`'strict-dynamic'`);
  });

  it('CSP header contains frame-src none', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).toContain(`frame-src 'none'`);
  });

  it('CSP header contains upgrade-insecure-requests', () => {
    const response = middleware(makeRequest('/'));
    expect(response.headers.get('Content-Security-Policy')).toContain('upgrade-insecure-requests');
  });

  it('two successive requests produce different nonces (per-request, not module-level)', () => {
    const response1 = middleware(makeRequest('/'));
    const response2 = middleware(makeRequest('/'));
    const nonce1 = response1.headers.get('x-nonce');
    const nonce2 = response2.headers.get('x-nonce');
    expect(nonce1).not.toBeNull();
    expect(nonce2).not.toBeNull();
    // Extremely unlikely to collide; if they do, the implementation is wrong
    expect(nonce1).not.toEqual(nonce2);
  });

  it('nonce in x-nonce matches nonce embedded in CSP for each request independently', () => {
    const r1 = middleware(makeRequest('/'));
    const r2 = middleware(makeRequest('/en'));
    // Each response pairs its own nonce correctly
    expect(r1.headers.get('Content-Security-Policy')).toContain(
      `'nonce-${r1.headers.get('x-nonce')}'`,
    );
    expect(r2.headers.get('Content-Security-Policy')).toContain(
      `'nonce-${r2.headers.get('x-nonce')}'`,
    );
  });
});
