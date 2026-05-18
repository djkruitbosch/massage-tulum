import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  SignJWT,
  createRemoteJWKSet,
  exportJWK,
  generateKeyPair,
  jwksCache as jwksCacheSymbol,
  type JSONWebKeySet,
} from 'jose';
import { SupabaseJwtGuard } from '../supabase-jwt.guard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://test-project.supabase.co';
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const KID = 'test-kid-0001';
const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

let privateKey: PrivateKey;
let publicJwk: Record<string, unknown>;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'ES256', use: 'sig' };
});

async function signToken(
  overrides: Record<string, unknown> = {},
  opts: { kid?: string; expiresIn?: string; algorithm?: 'ES256' } = {},
) {
  return new SignJWT({ role: 'authenticated', ...overrides })
    .setProtectedHeader({ alg: opts.algorithm ?? 'ES256', kid: opts.kid ?? KID, typ: 'JWT' })
    .setSubject((overrides['sub'] as string | undefined) ?? USER_ID)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(privateKey);
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

/**
 * Prime the guard's internal JWKS resolver with a pre-populated jwksCache so
 * jose never makes an HTTP request during tests. White-box: relies on
 * `cachedJwks` / `cachedJwksUrl` private-field shape. If those rename, this
 * helper updates with them.
 */
function primeGuardWithLocalJwks(guard: SupabaseJwtGuard, jwksUrl = JWKS_URL): void {
  const jwks: JSONWebKeySet = { keys: [publicJwk as unknown as JSONWebKeySet['keys'][number]] };
  const cache = { jwks, uat: Date.now() };
  const resolver = createRemoteJWKSet(new URL(jwksUrl), { [jwksCacheSymbol]: cache });
  (guard as unknown as { cachedJwks: unknown; cachedJwksUrl: string }).cachedJwks = resolver;
  (guard as unknown as { cachedJwks: unknown; cachedJwksUrl: string }).cachedJwksUrl = jwksUrl;
}

// ─── SupabaseJwtGuard ─────────────────────────────────────────────────────────

describe('SupabaseJwtGuard', () => {
  let guard: SupabaseJwtGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    guard = new SupabaseJwtGuard();
    process.env = { ...originalEnv, SUPABASE_URL };
    primeGuardWithLocalJwks(guard);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows a request with a valid JWT', async () => {
    const token = await signToken();
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('attaches userId and jwtPayload to the request', async () => {
    const token = await signToken();
    const request = { headers: { authorization: `Bearer ${token}` } } as {
      headers: { authorization: string };
      userId?: string;
      jwtPayload?: { sub?: string };
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(request.userId).toBe(USER_ID);
    expect(request.jwtPayload).toMatchObject({ sub: USER_ID });
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header has wrong scheme', async () => {
    const ctx = makeContext('Basic abc123');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when SUPABASE_URL is not set', async () => {
    delete process.env['SUPABASE_URL'];
    const token = await signToken();
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an expired token', async () => {
    const token = await signToken({}, { expiresIn: '-1s' });
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a token signed by an unknown key', async () => {
    const otherPair = await generateKeyPair('ES256');
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KID, typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherPair.privateKey);
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the kid does not match any JWKS key', async () => {
    const token = await signToken({}, { kid: 'unknown-kid' });
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when issuer claim does not match SUPABASE_URL', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KID, typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer('https://attacker.example/auth/v1')
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when audience claim is not "authenticated"', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: KID, typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('service_role')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    const ctx = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('reuses the same JWKS resolver across requests', async () => {
    const t1 = await signToken();
    const t2 = await signToken({ sub: 'bbbbbbbb-0000-0000-0000-000000000002' });

    await guard.canActivate(makeContext(`Bearer ${t1}`));
    await guard.canActivate(makeContext(`Bearer ${t2}`));

    // The cached resolver reference should remain stable across calls.
    const cached = (guard as unknown as { cachedJwks: unknown }).cachedJwks;
    expect(cached).toBeTruthy();
  });
});
