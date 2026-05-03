import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp';

describe('buildCsp', () => {
  it('returns a string containing the nonce in script-src', () => {
    const nonce = 'abc123==';
    const csp = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('includes default-src self', () => {
    const csp = buildCsp('testnonce');
    expect(csp).toContain(`default-src 'self'`);
  });

  it('includes strict-dynamic in script-src', () => {
    const csp = buildCsp('testnonce');
    expect(csp).toContain(`'strict-dynamic'`);
  });

  it('does not include unsafe-inline in script-src', () => {
    const csp = buildCsp('testnonce');
    // unsafe-inline must not appear in script-src (ADR-0006 hard requirement)
    // It may appear in style-src but not script-src
    const scriptSrcDirective = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrcDirective).toBeDefined();
    expect(scriptSrcDirective).not.toContain(`'unsafe-inline'`);
  });

  it('includes unsafe-inline in style-src (Tailwind JIT accepted tradeoff)', () => {
    const csp = buildCsp('testnonce');
    const styleSrcDirective = csp.split(';').find((d) => d.trim().startsWith('style-src'));
    expect(styleSrcDirective).toBeDefined();
    expect(styleSrcDirective).toContain(`'unsafe-inline'`);
  });

  it('includes frame-src none', () => {
    const csp = buildCsp('testnonce');
    expect(csp).toContain(`frame-src 'none'`);
  });

  it('includes upgrade-insecure-requests', () => {
    const csp = buildCsp('testnonce');
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('includes Supabase origins in connect-src', () => {
    const csp = buildCsp('testnonce');
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('wss://*.supabase.co');
  });

  it('produces different CSP strings for different nonces', () => {
    const csp1 = buildCsp('nonce-one');
    const csp2 = buildCsp('nonce-two');
    expect(csp1).not.toEqual(csp2);
  });
});
