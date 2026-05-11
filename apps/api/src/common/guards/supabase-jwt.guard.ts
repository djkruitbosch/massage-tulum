import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * SupabaseJwtGuard — verifies Supabase JWTs without a network round-trip.
 *
 * Design (GATE 2 accepted default, 2026-05-03):
 *   1. Extract Bearer token from Authorization header.
 *   2. Verify JWT signature against SUPABASE_JWT_SECRET using jsonwebtoken.
 *   3. Attach decoded payload to request as `jwtPayload` for downstream use.
 *
 * JWT verification is local (no Supabase Auth network call), making it
 * suitable for high-frequency endpoints like GET/PATCH /api/studios/me.
 *
 * The service-role guard (AdminGuard) uses supabase.auth.getUser() instead —
 * appropriate for low-frequency admin calls where revocation matters more.
 *
 * Environment variables:
 *   SUPABASE_JWT_SECRET — JWT secret from Supabase project settings > API.
 *                         Never commit this value.
 *
 * Security:
 *   - Token must be signed with HS256 (Supabase default).
 *   - Expired tokens are rejected (jwt.verify checks exp by default).
 *   - PII (email, name) inside token is never logged — only sub (user_id).
 *
 * See: docs/adr/0007-supabase-auth-magic-link.md
 *      GATE 2 defaults accepted for CU-869d8cnt3
 */

/** Shape of a verified Supabase JWT payload. */
export interface SupabaseJwtPayload {
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

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    const secret = process.env['SUPABASE_JWT_SECRET'];
    if (!secret) {
      this.logger.error('SUPABASE_JWT_SECRET env var is not set');
      throw new UnauthorizedException('Server configuration error');
    }

    let payload: SupabaseJwtPayload;
    try {
      payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        // Supabase JWTs may have 'authenticated' as audience in some configs;
        // we accept any audience to be flexible across local dev and hosted envs.
      }) as SupabaseJwtPayload;
    } catch (err) {
      // Log token ID only (no PII). jwt.verify errors include TokenExpiredError,
      // JsonWebTokenError (bad signature), NotBeforeError.
      this.logger.warn(
        `JWT verification failed: ${err instanceof Error ? err.name : 'unknown error'}`,
      );
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
}
