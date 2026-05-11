import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SupabaseJwtGuard } from '../supabase-jwt.guard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Test fixture only. Not a real secret. Gitleaks generic-api-key whitelisted via annotation.
const JWT_SECRET = 'test-secret-at-least-32-chars-long-ok'; // gitleaks:allow
const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function makeValidToken(overrides: Partial<jwt.JwtPayload> = {}): string {
  return jwt.sign({ sub: USER_ID, role: 'authenticated', ...overrides }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

function makeContext(authHeader: string | undefined): ExecutionContext {
  const request = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// ─── SupabaseJwtGuard ─────────────────────────────────────────────────────────

describe('SupabaseJwtGuard', () => {
  let guard: SupabaseJwtGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    guard = new SupabaseJwtGuard();
    process.env = { ...originalEnv, SUPABASE_JWT_SECRET: JWT_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows a request with a valid JWT', () => {
    const token = makeValidToken();
    const ctx = makeContext(`Bearer ${token}`);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('attaches userId and jwtPayload to the request', () => {
    const token = makeValidToken();
    const request = { headers: { authorization: `Bearer ${token}` } } as {
      headers: { authorization: string };
      userId?: string;
      jwtPayload?: jwt.JwtPayload;
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    expect(request.userId).toBe(USER_ID);
    expect(request.jwtPayload).toMatchObject({ sub: USER_ID });
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header has wrong scheme', () => {
    const ctx = makeContext('Basic abc123');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when SUPABASE_JWT_SECRET is not set', () => {
    delete process.env['SUPABASE_JWT_SECRET'];
    const token = makeValidToken();
    const ctx = makeContext(`Bearer ${token}`);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an expired token', () => {
    const token = jwt.sign({ sub: USER_ID }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
    const ctx = makeContext(`Bearer ${token}`);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a token signed with wrong secret', () => {
    const token = jwt.sign({ sub: USER_ID }, 'wrong-secret', { algorithm: 'HS256' });
    const ctx = makeContext(`Bearer ${token}`);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a token missing the sub claim', () => {
    // Token with no sub
    const token = jwt.sign({ role: 'authenticated' }, JWT_SECRET, { algorithm: 'HS256' });
    const ctx = makeContext(`Bearer ${token}`);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
