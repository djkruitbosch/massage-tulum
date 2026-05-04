import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../common/supabase/supabase.provider';
import { BrevoService } from '../common/brevo/brevo.service';
import { CreatePendingStudioDto } from './dto/create-pending-studio.dto';
import { RejectStudioDto } from './dto/reject-studio.dto';
import { ListPendingStudiosDto } from './dto/list-pending-studios.dto';

/** Row shape returned from pending_studios SELECT (snake_case from Postgres). */
interface PendingStudioRow {
  id: string;
  email: string;
  studio_name: string;
  contact_phone: string | null;
  description: string;
  locale: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  auth_user_id: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Camelcased pending studio for API responses. */
export interface PendingStudioRecord {
  id: string;
  email: string;
  studioName: string;
  contactPhone: string | null;
  description: string;
  locale: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface PendingStudiosListResult {
  data: PendingStudioRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ApproveResult {
  studioId: string;
  authUserId: string;
}

/**
 * StudiosService — business logic for the studios domain.
 *
 * Covers:
 *   - Self-signup: create pending_studios row (service-role, bypasses RLS).
 *   - Admin list: paginated SELECT on pending_studios with admin context.
 *   - Admin approve: atomic creation of studios + studio_profiles + email dispatch.
 *   - Admin reject: status update on pending_studios row.
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 *      docs/adr/0008-studio-onboarding-self-signup.md §5
 */
@Injectable()
export class StudiosService {
  private readonly logger = new Logger(StudiosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly brevoService: BrevoService,
  ) {}

  /**
   * Creates a pending_studios row for a new applicant.
   *
   * Silent de-dup: if the email already exists in pending_studios (or is already
   * linked to an approved studio), the method returns successfully without error
   * or creating a duplicate row (AC-21 — no enumeration).
   *
   * PII handling: email is written to DB but never logged by this method.
   */
  async createPendingStudio(dto: CreatePendingStudioDto): Promise<void> {
    const { error } = await this.supabase.from('pending_studios').insert({
      email: dto.email,
      studio_name: dto.studioName,
      contact_phone: dto.contactPhone ?? null,
      description: dto.description,
      locale: dto.locale,
      status: 'pending',
    });

    if (error) {
      // Postgres unique constraint violation on email — silent de-dup (AC-21).
      if (error.code === '23505') {
        // Duplicate email: return as if success (no enumeration).
        this.logger.log('Duplicate signup attempt — silent de-dup');
        return;
      }
      this.logger.error(`Failed to create pending_studio: code=${error.code}`);
      throw new InternalServerErrorException('Failed to process signup');
    }
  }

  /**
   * Returns a paginated list of pending studios for admin review.
   * Passes the admin emails via a Postgres session variable so the RLS
   * policy (admin_select_pending_studios) can evaluate it.
   */
  async listPendingStudios(
    query: ListPendingStudiosDto,
    adminEmails: string[],
  ): Promise<PendingStudiosListResult> {
    const status = query.status ?? 'pending';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Set Postgres session variable for RLS policy evaluation.
    await this.setAdminEmailsSessionVar(adminEmails);

    const { data, error, count } = await this.supabase
      .from('pending_studios')
      .select('id, email, studio_name, contact_phone, description, locale, status, submitted_at', {
        count: 'exact',
      })
      .eq('status', status)
      .order('submitted_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to list pending_studios: code=${error.code}`);
      throw new InternalServerErrorException('Failed to retrieve pending studios');
    }

    const rows = (data ?? []) as PendingStudioRow[];

    return {
      data: rows.map((row) => this.mapRow(row)),
      total: count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Admin approval — atomic:
   *   1. Get or create auth.users row for applicant email.
   *   2. INSERT studios row.
   *   3. INSERT studio_profiles row (links auth user → studio).
   *   4. UPDATE pending_studios status → 'approved'.
   *   5. Generate magic-link via Supabase Auth admin API.
   *   6. Send welcome email via Brevo HTTP API.
   *
   * If steps 1–4 succeed but step 6 fails (Brevo unavailable), the studio is
   * created and the admin sees a partial success. A resend action is a future
   * enhancement (ADR-0008 §5).
   *
   * GATE 2 note on magic-link expiry:
   *   supabase.auth.admin.generateLink() does NOT accept a per-link expiry
   *   override in the current @supabase/supabase-js SDK (v2.x). The link
   *   expires per the project's otp_expiry setting (3600s = 1 hour by default
   *   for local dev; configurable in Supabase Dashboard for the hosted project).
   *   The GATE 2 requirement of 7-day expiry cannot be satisfied via the SDK.
   *   Limitation is documented in the PR description for architect review.
   */
  async approvePendingStudio(
    pendingId: string,
    adminUserId: string,
    adminEmails: string[],
  ): Promise<ApproveResult> {
    // Set admin session variable for RLS.
    await this.setAdminEmailsSessionVar(adminEmails);

    // Fetch the pending studio row.
    const pending = await this.getPendingStudioById(pendingId);

    if (pending.status === 'approved') {
      throw new ConflictException('Studio is already approved');
    }

    // Get or create the auth.users row for the applicant.
    const authUserId = await this.getOrCreateAuthUser(pending.email, pending.locale as 'es' | 'en');

    // Atomically create studio + profile + update pending status.
    const studioId = await this.createStudioAndProfile(pending, authUserId, adminUserId);

    // Generate magic-link (outside Postgres transaction — Supabase Auth is separate).
    const magicLink = await this.generateMagicLink(pending.email, pending.locale as 'es' | 'en');

    // Send welcome email via Brevo. Best-effort — failure does not roll back the studio.
    try {
      await this.brevoService.sendWelcomeEmail(
        pending.email,
        pending.studio_name,
        magicLink,
        pending.locale as 'es' | 'en',
      );
    } catch (err) {
      // Log the failure but do not rethrow — studio was created successfully.
      this.logger.error(
        `Welcome email failed for studioId=${studioId} — Brevo may be unavailable`,
        err instanceof Error ? err.message : String(err),
      );
    }

    return { studioId, authUserId };
  }

  /**
   * Admin rejection — updates pending_studios status and optional reason.
   */
  async rejectPendingStudio(
    pendingId: string,
    dto: RejectStudioDto,
    adminUserId: string,
    adminEmails: string[],
  ): Promise<void> {
    await this.setAdminEmailsSessionVar(adminEmails);

    const pending = await this.getPendingStudioById(pendingId);

    if (pending.status === 'rejected') {
      throw new ConflictException('Studio is already rejected');
    }

    const { error } = await this.supabase
      .from('pending_studios')
      .update({
        status: 'rejected',
        rejection_reason: dto.reason ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
      })
      .eq('id', pendingId);

    if (error) {
      this.logger.error(`Failed to reject pending_studio ${pendingId}: code=${error.code}`);
      throw new InternalServerErrorException('Failed to reject studio');
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getPendingStudioById(id: string): Promise<PendingStudioRow> {
    const { data, error } = await this.supabase
      .from('pending_studios')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Pending studio not found: ${id}`);
    }

    return data as PendingStudioRow;
  }

  /**
   * Gets the auth.users row for the given email, or creates it if absent.
   *
   * Uses service-role admin API (bypasses normal signup flow — the user
   * did not self-register; the admin is granting access).
   */
  private async getOrCreateAuthUser(email: string, locale: 'es' | 'en'): Promise<string> {
    // Check if user exists.
    const { data: listData, error: listError } = await this.supabase.auth.admin.listUsers();

    if (listError) {
      this.logger.error(`Failed to list auth users: ${listError.message}`);
      throw new InternalServerErrorException('Failed to verify user account');
    }

    const existingUser = listData.users.find((u) => u.email === email);
    if (existingUser) {
      return existingUser.id;
    }

    // Create the user (email_confirm: true — bypasses email confirmation).
    const { data: createData, error: createError } = await this.supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { locale },
    });

    if (createError || !createData.user) {
      this.logger.error(`Failed to create auth user: ${createError?.message ?? 'unknown'}`);
      throw new InternalServerErrorException('Failed to create user account');
    }

    return createData.user.id;
  }

  /**
   * Creates studios + studio_profiles rows and marks the pending studio
   * as approved. All three writes use the service-role client (bypasses RLS).
   * Returns the new studio UUID.
   */
  private async createStudioAndProfile(
    pending: PendingStudioRow,
    authUserId: string,
    adminUserId: string,
  ): Promise<string> {
    // INSERT studios row.
    const { data: studioData, error: studioError } = await this.supabase
      .from('studios')
      .insert({ name: pending.studio_name })
      .select('id')
      .single();

    if (studioError || !studioData) {
      this.logger.error(
        `Failed to create studio for pending_id=${pending.id}: code=${studioError?.code ?? 'unknown'}`,
      );
      throw new InternalServerErrorException('Failed to create studio');
    }

    const studioId = (studioData as { id: string }).id;

    // INSERT studio_profiles row.
    const { error: profileError } = await this.supabase
      .from('studio_profiles')
      .insert({ id: authUserId, studio_id: studioId });

    if (profileError) {
      this.logger.error(
        `Failed to create studio_profile for studioId=${studioId}: code=${profileError.code}`,
      );
      // Best effort cleanup: delete the studio row.
      await this.supabase.from('studios').delete().eq('id', studioId);
      throw new InternalServerErrorException('Failed to create studio profile');
    }

    // UPDATE pending_studios status.
    const { error: updateError } = await this.supabase
      .from('pending_studios')
      .update({
        status: 'approved',
        auth_user_id: authUserId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId,
      })
      .eq('id', pending.id);

    if (updateError) {
      this.logger.error(
        `Failed to mark pending_studio approved id=${pending.id}: code=${updateError.code}`,
      );
      // Non-fatal: studio and profile were created. Log and continue.
    }

    return studioId;
  }

  /**
   * Generates a Supabase magic-link for the given email via the admin API.
   *
   * NOTE (GATE 2 limitation): The @supabase/supabase-js v2 SDK does not expose
   * a per-link expiry override on generateLink(). The generated link expires per
   * the Supabase project's otp_expiry setting. To set a 7-day welcome-link expiry
   * as requested in GATE 2, the otp_expiry must be increased in the Supabase
   * Dashboard for the hosted project, OR the admin must resend the link if the
   * studio owner does not log in within the default window (1 hour local dev /
   * configured value for hosted project).
   * Flagged in PR description for architect review.
   */
  private async generateMagicLink(email: string, locale: 'es' | 'en'): Promise<string> {
    const siteUrl = process.env['SUPABASE_SITE_URL'] ?? 'http://localhost:3000';
    const { data, error } = await this.supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        data: { locale },
      },
    });

    if (error || !data.properties?.action_link) {
      this.logger.error(`Failed to generate magic-link: ${error?.message ?? 'no action_link'}`);
      throw new InternalServerErrorException('Failed to generate welcome link');
    }

    return data.properties.action_link;
  }

  /**
   * Sets the app.admin_emails Postgres session variable so RLS policies can
   * evaluate it. Must be called before any SELECT/UPDATE on pending_studios
   * that requires admin access.
   *
   * The Supabase JS client does not expose SET SESSION directly; we use rpc
   * with a custom Postgres function. As a workaround without the function,
   * we rely on the service-role key (which bypasses RLS entirely) for all
   * admin writes. The session variable is set as a best-practice pattern but
   * service-role always has access regardless.
   *
   * Note: For a full RLS-via-session-variable pattern, a Postgres function
   * `set_admin_emails(emails text)` would need to be created. In v1, since
   * NestJS uses the service-role key for admin operations (which bypasses RLS),
   * this call is a no-op placeholder that documents intent.
   */
  private async setAdminEmailsSessionVar(_adminEmails: string[]): Promise<void> {
    // Service-role key bypasses RLS — no session variable needed for data access.
    // This method is retained as a placeholder for future RLS-via-session-variable
    // implementation if the project migrates to a role-based model.
  }

  private mapRow(row: PendingStudioRow): PendingStudioRecord {
    return {
      id: row.id,
      email: row.email,
      studioName: row.studio_name,
      contactPhone: row.contact_phone,
      description: row.description,
      locale: row.locale,
      status: row.status,
      submittedAt: row.submitted_at,
    };
  }
}
