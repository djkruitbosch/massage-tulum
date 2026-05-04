import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.provider';

/**
 * AdminGuard — validates JWT and checks caller is in ADMIN_EMAILS env var.
 *
 * Design (ADR-0008 §3):
 *   1. Extract Bearer token from Authorization header.
 *   2. Validate JWT via supabase.auth.getUser(token) — network call to Supabase Auth.
 *   3. Check caller's email is in the ADMIN_EMAILS comma-separated list.
 *   4. Attach user + adminEmails to request for downstream use by service.
 *
 * Security:
 *   - Being in ADMIN_EMAILS without a valid JWT grants nothing.
 *   - Admin routes return 403 (mapped to 404 at routing layer by the controller)
 *     for non-admin requests — avoid route discovery (AC-22).
 *   - Email is never logged (PII rule). Log auth_user_id only.
 *
 * ADMIN_EMAILS format: comma-separated, e.g. "admin@example.com,other@example.com"
 * Leading/trailing whitespace around each email is trimmed.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract Bearer token.
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.slice(7); // strip "Bearer "

    // Validate JWT with Supabase Auth.
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = data.user.id;
    const userEmail = data.user.email;

    if (!userEmail) {
      // Supabase user exists but has no email (e.g. phone-only user) — not an admin.
      throw new ForbiddenException('Caller is not an admin');
    }

    // Check ADMIN_EMAILS allowlist.
    const adminEmailsRaw = process.env['ADMIN_EMAILS'] ?? '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(userEmail.toLowerCase())) {
      // Log only user ID (no email — PII rule).
      this.logger.warn(`Non-admin access attempt — user_id=${userId}`);
      throw new ForbiddenException('Caller is not an admin');
    }

    // Attach to request for use in controllers / services.
    (request as Request & { adminUserId: string; adminEmails: string[] }).adminUserId = userId;
    (request as Request & { adminUserId: string; adminEmails: string[] }).adminEmails = adminEmails;

    return true;
  }
}
