import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { StudioResolverService } from '../common/services/studio-resolver.service';
import { UpdateStudioProfileDto } from './dto/update-studio-profile.dto';
import { trimTime } from '@massage-tulum/shared';

// ─── Row types (Postgres snake_case) ─────────────────────────────────────────

interface StudioRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  updated_at: string;
}

interface StudioHoursRow {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface StudioHoursEntry {
  weekday: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface StudioProfileResponse {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  hours: StudioHoursEntry[];
  updatedAt: string;
}

/**
 * StudiosProfileService — GET and PATCH for the studio owner's profile.
 *
 * Studio ownership is resolved via StudioResolverService (shared provider).
 * All other reads/writes use a per-request user-scoped client (anon key + JWT)
 * for RLS-enforced reads/writes on studios and studio_hours.
 *
 * See: docs/architecture/CU-869d29f1h-studio-profile.md §3
 *      docs/adr/0003-rls-baseline-conventions.md §Convention 4
 */
@Injectable()
export class StudiosProfileService {
  private readonly logger = new Logger(StudiosProfileService.name);

  constructor(private readonly studioResolver: StudioResolverService) {}

  /**
   * Creates a per-request user-scoped Supabase client (anon key + JWT).
   *
   * RLS policies on studios / studio_hours use auth.uid() derived from this
   * JWT to enforce that owners can only read/write their own studio's data.
   */
  private buildUserClient(jwt: string): SupabaseClient {
    const url = process.env['SUPABASE_URL'];
    const anonKey = process.env['SUPABASE_ANON_KEY'];

    if (!url || !anonKey) {
      throw new InternalServerErrorException('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }

    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * GET /api/studios/me — returns the authenticated studio owner's profile.
   *
   * @param userId  The auth.uid() from the verified JWT sub claim.
   * @param jwt     Raw JWT string for user-scoped Supabase client.
   */
  async getMyProfile(userId: string, jwt: string): Promise<StudioProfileResponse> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch studio row (RLS enforces ownership).
    const { data: studioData, error: studioError } = await userClient
      .from('studios')
      .select('id, name, address, phone, email, description, updated_at')
      .eq('id', studioId)
      .single();

    if (studioError || !studioData) {
      this.logger.error(`Failed to fetch studio studioId=${studioId}: ${studioError?.message}`);
      throw new NotFoundException('Studio not found');
    }

    const studio = studioData as StudioRow;

    // Fetch hours (RLS enforces ownership).
    const { data: hoursData, error: hoursError } = await userClient
      .from('studio_hours')
      .select('weekday, is_open, open_time, close_time')
      .eq('studio_id', studioId)
      .order('weekday', { ascending: true });

    if (hoursError) {
      this.logger.error(`Failed to fetch studio_hours studioId=${studioId}: ${hoursError.message}`);
      throw new InternalServerErrorException('Failed to retrieve studio hours');
    }

    const hours = ((hoursData ?? []) as StudioHoursRow[]).map(this.mapHoursRow);

    return this.mapStudioRow(studio, hours);
  }

  /**
   * PATCH /api/studios/me — partial update of the studio owner's profile.
   *
   * Business rules:
   *   - name, address, phone, email — any subset may be updated.
   *   - hours — full 7-element replacement when provided.
   *   - After update: studio must have name + at least one contact (phone OR email).
   *     Checked against the merged state (existing + patch values).
   *   - Concurrency: last-write-wins (no optimistic locking in v1).
   *
   * @param userId  The auth.uid() from the verified JWT sub claim.
   * @param jwt     Raw JWT string for user-scoped Supabase client.
   * @param dto     The PATCH body.
   */
  async patchMyProfile(
    userId: string,
    jwt: string,
    dto: UpdateStudioProfileDto,
  ): Promise<StudioProfileResponse> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch current state to validate business rules against merged data.
    const { data: currentData, error: currentError } = await userClient
      .from('studios')
      .select('id, name, address, phone, email, description, updated_at')
      .eq('id', studioId)
      .single();

    if (currentError || !currentData) {
      throw new NotFoundException('Studio not found');
    }

    const current = currentData as StudioRow;

    // Compute merged state for business rule validation.
    const mergedName = dto.name ?? current.name;
    const mergedPhone = dto.phone !== undefined ? dto.phone : current.phone;
    const mergedEmail = dto.email !== undefined ? dto.email : current.email;

    // AC: studio must have name + at least one contact method.
    if (!mergedName) {
      throw new BadRequestException('Studio name is required');
    }
    if (!mergedPhone && !mergedEmail) {
      throw new BadRequestException('At least one contact method is required (phone or email)');
    }

    // Build the UPDATE payload (only include defined fields).
    const updatePayload: Partial<{
      name: string;
      address: string | null;
      phone: string | null;
      email: string | null;
      description: string | null;
    }> = {};

    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.address !== undefined) updatePayload.address = dto.address ?? null;
    if (dto.phone !== undefined) updatePayload.phone = dto.phone ?? null;
    if (dto.email !== undefined) updatePayload.email = dto.email ?? null;
    if (dto.description !== undefined) updatePayload.description = dto.description ?? null;

    // Update studios row if there are column changes.
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await userClient
        .from('studios')
        .update(updatePayload)
        .eq('id', studioId);

      if (updateError) {
        this.logger.error(`Failed to update studio studioId=${studioId}: ${updateError.message}`);
        throw new InternalServerErrorException('Failed to update studio profile');
      }
    }

    // Upsert hours via Postgres function (atomic DELETE+INSERT).
    if (dto.hours !== undefined) {
      await this.upsertHours(userClient, studioId, dto.hours);
    }

    // Return the refreshed profile.
    return this.getMyProfile(userId, jwt);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Calls the upsert_studio_hours() Postgres function to atomically
   * replace all 7 weekday rows for the studio.
   */
  private async upsertHours(
    userClient: SupabaseClient,
    studioId: string,
    hours: UpdateStudioProfileDto['hours'] & {},
  ): Promise<void> {
    const hoursJson = hours.map((h) => ({
      weekday: h.weekday,
      is_open: h.isOpen,
      open_time: h.openTime ?? null,
      close_time: h.closeTime ?? null,
    }));

    const { error } = await userClient.rpc('upsert_studio_hours', {
      p_studio_id: studioId,
      p_hours: JSON.stringify(hoursJson),
    });

    if (error) {
      this.logger.error(`Failed to upsert studio_hours studioId=${studioId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to update studio hours');
    }
  }

  private mapHoursRow(row: StudioHoursRow): StudioHoursEntry {
    return {
      weekday: row.weekday,
      isOpen: row.is_open,
      openTime: row.open_time ? trimTime(row.open_time) : null,
      closeTime: row.close_time ? trimTime(row.close_time) : null,
    };
  }

  private mapStudioRow(studio: StudioRow, hours: StudioHoursEntry[]): StudioProfileResponse {
    return {
      id: studio.id,
      name: studio.name,
      address: studio.address,
      phone: studio.phone,
      email: studio.email,
      description: studio.description,
      hours,
      updatedAt: studio.updated_at,
    };
  }
}
