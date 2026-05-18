import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * SupabaseJwtGuard — verifies Supabase JWTs via the project's JWKS endpoint.
 *
 * Supabase migrated to asymmetric JWT signing keys (ES256 / RS256) in 2024.
 * Symmetric HS256 verification with `SUPABASE_JWT_SECRET` no longer works for
 * projects on the new key system. This guard verifies signatures against the
 * project's public JWKS, selecting the correct key by the token header `kid`.
 *
 * Verification flow:
 *   1. Extract Bearer token from Authorization header.
 *   2. Use jose's remote JWKS (with built-in cache + cooldown) to resolve the
 *      signing key by `kid` from the token header.
 *   3. Verify signature, `iss`, `aud`, and `exp` in one call.
 *   4. Attach the decoded payload to the request as `jwtPayload`.
 *
 * Performance:
 *   The JWKS is fetched once and reused via jose's in-memory cache. Subsequent
 *   token verifications are CPU-only (no network). On `kid` rotation (rare,
 *   triggered by manual key rotation in Supabase), jose refreshes the JWKS.
 *
 * Environment variables:
 *   SUPABASE_URL — Supabase project URL (e.g. https://xyz.supabase.co).
 *                  Used to derive both the JWKS URI and the expected issuer.
 *
 * Security:
 *   - Accepts ES256 and RS256 only (Supabase's asymmetric algorithms).
 *   - Validates `iss` matches the project's auth endpoint.
 *   - Validates `aud` is 'authenticated' (Supabase default for user tokens).
 *   - Expired tokens are rejected.
 *   - PII (email, name) inside token is never logged — only `sub` (user_id).
 *
 * See: docs/adr/0007-supabase-auth-magic-link.md
 *      docs/adr/0012-asymmetric-supabase-jwt-verify.md
 */

const ACCEPTED_ALGORITHMS = ['ES256', 'RS256'] as const;
const EXPECTED_AUDIENCE = 'authenticated';

/** Shape of a verified Supabase JWT payload. */
export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/** Request shape after SupabaseJwtGuard runs. */
export interface JwtRequest extends Request {
  jwtPayload: SupabaseJwtPayload;
  /** Convenience alias: the auth.uid() value from the JWT sub claim. */
  userId: string;
}

/** JWKS resolver type — what createRemoteJWKSet returns. */
type JwksResolver = ReturnType<typeof createRemoteJWKSet>;

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);
  private cachedJwks: JwksResolver | null = null;
  private cachedJwksUrl: string | null = null;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    const supabaseUrl = process.env['SUPABASE_URL'];
    if (!supabaseUrl) {
      this.logger.error('SUPABASE_URL env var is not set');
      throw new UnauthorizedException('Server configuration error');
    }

    const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
    const jwks = this.getJwksResolver(`${issuer}/.well-known/jwks.json`);

    let payload: SupabaseJwtPayload;
    try {
      const verified = await jwtVerify(token, jwks, {
        algorithms: [...ACCEPTED_ALGORITHMS],
        issuer,
        audience: EXPECTED_AUDIENCE,
      });
      payload = verified.payload as SupabaseJwtPayload;
    } catch (err) {
      // Log error name + message (no PII). jose errors include JWTExpired,
      // JWTInvalid, JWSSignatureVerificationFailed, JWKSNoMatchingKey, etc.
      const name = err instanceof Error ? err.name : 'unknown error';
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`JWT verification failed: ${name}: ${msg}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token missing sub claim');
    }

    // Attach to request for downstream controller/service use.
    const jwtReq = request as JwtRequest;
    jwtReq.jwtPayload = payload;
    jwtReq.userId = payload.sub;

    return true;
  }

  /**
   * Lazily build a remote-JWKS resolver and cache it. jose's resolver does
   * its own in-memory caching of the fetched keys (default 30s cooldown, 10m
   * cache); we only memoize the resolver object itself to avoid re-creating
   * it on every request. Re-creates if SUPABASE_URL changes (test-only path).
   */
  private getJwksResolver(jwksUrl: string): JwksResolver {
    if (this.cachedJwks && this.cachedJwksUrl === jwksUrl) {
      return this.cachedJwks;
    }
    this.cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    this.cachedJwksUrl = jwksUrl;
    return this.cachedJwks;
  }
}
