import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { StudioResolverService } from '../common/services/studio-resolver.service';
import { CreateTherapistDto } from './dto/create-therapist.dto';
import { UpdateTherapistDto } from './dto/update-therapist.dto';
import { UpdateTherapistStatusDto } from './dto/update-therapist-status.dto';
import { TherapistResponseDto } from './dto/therapist-response.dto';

// ─── Row types (Postgres snake_case) ─────────────────────────────────────────

interface TherapistRow {
  id: string;
  studio_id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  photo_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

type TherapistStatus = 'active' | 'inactive' | 'all';

const STORAGE_BUCKET = 'therapist-photos';
const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * TherapistsService — CRUD, status toggle, and photo upload for therapists.
 *
 * Studio ownership is resolved via StudioResolverService (shared provider).
 * All other reads/writes use a per-request user-scoped client (anon key + JWT)
 * so that RLS enforces studio ownership on every DB operation.
 *
 * studio_id is never accepted from the request body — always resolved from
 * the authenticated user's JWT sub claim via StudioResolverService.
 *
 * PII policy: therapist name, phone, and email are never logged.
 * Log only therapistId and studioId (UUIDs) for correlation.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4
 *      docs/adr/0011-studio-scoped-resource-pattern.md
 */
@Injectable()
export class TherapistsService {
  private readonly logger = new Logger(TherapistsService.name);

  constructor(private readonly studioResolver: StudioResolverService) {}

  // ─── Public methods ──────────────────────────────────────────────────────────

  /**
   * GET /api/studios/therapists — lists therapists for the authenticated studio.
   *
   * Generates signed URLs in a single batch call for all therapists that have
   * a non-null photo_url. The raw Storage path is never returned to callers.
   *
   * @param userId  auth.uid() from the verified JWT sub claim
   * @param jwt     raw JWT for user-scoped Supabase client
   * @param status  'active' | 'inactive' | 'all' (default: 'all')
   */
  async listTherapists(
    userId: string,
    jwt: string,
    status: TherapistStatus = 'all',
  ): Promise<TherapistResponseDto[]> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Build query: apply status filter before order() to maintain a chainable pattern.
    let query = userClient
      .from('therapists')
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .eq('studio_id', studioId);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to list therapists for studioId=${studioId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve therapists');
    }

    const rows = (data ?? []) as TherapistRow[];

    // Batch-generate signed URLs for all rows with a photo_url.
    const signedUrlMap = await this.buildSignedUrlMap(userClient, rows);

    return rows.map((row) => this.mapRowToDto(row, signedUrlMap.get(row.id) ?? null));
  }

  /**
   * POST /api/studios/therapists — creates a new therapist.
   *
   * studio_id is resolved from the JWT; not accepted from the request body.
   * Returns 201 + the created therapist (no photoUrl — photo is edit-only).
   *
   * @param userId  auth.uid()
   * @param jwt     raw JWT
   * @param dto     validated CreateTherapistDto
   */
  async createTherapist(
    userId: string,
    jwt: string,
    dto: CreateTherapistDto,
  ): Promise<TherapistResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    const insertPayload = {
      studio_id: studioId,
      name: dto.name.trim(),
      role: dto.role.trim(),
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
    };

    const { data, error } = await userClient
      .from('therapists')
      .insert(insertPayload)
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      this.logger.error(`Failed to create therapist for studioId=${studioId}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create therapist');
    }

    return this.mapRowToDto(data as TherapistRow, null);
  }

  /**
   * PATCH /api/studios/therapists/:id — partial update of therapist fields.
   *
   * Cannot update status here (use the dedicated /status endpoint).
   * If no affected rows after update, throws NotFoundException to avoid
   * information leakage about whether the UUID exists for another studio.
   *
   * @param userId       auth.uid()
   * @param jwt          raw JWT
   * @param therapistId  UUID of the therapist to update
   * @param dto          validated UpdateTherapistDto
   */
  async updateTherapist(
    userId: string,
    jwt: string,
    therapistId: string,
    dto: UpdateTherapistDto,
  ): Promise<TherapistResponseDto> {
    // At least one field must be provided.
    const providedKeys = Object.keys(dto).filter(
      (k) => dto[k as keyof UpdateTherapistDto] !== undefined,
    );
    if (providedKeys.length === 0) {
      throw new BadRequestException('At least one field must be provided for update');
    }

    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Build update payload from only the provided fields.
    const updatePayload: Partial<{
      name: string;
      role: string;
      phone: string | null;
      email: string | null;
      notes: string | null;
    }> = {};

    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.role !== undefined) updatePayload.role = dto.role.trim();
    if (dto.phone !== undefined) updatePayload.phone = dto.phone ?? null;
    if (dto.email !== undefined) updatePayload.email = dto.email ?? null;
    if (dto.notes !== undefined) updatePayload.notes = dto.notes ?? null;

    const { data, error } = await userClient
      .from('therapists')
      .update(updatePayload)
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      // RLS blocks cross-studio updates (zero rows) — return 404 to avoid info leakage.
      this.logger.warn(
        `Therapist not found or not owned: therapistId=${therapistId} studioId=${studioId}`,
      );
      throw new NotFoundException('Therapist not found');
    }

    const row = data as TherapistRow;
    const signedUrl = row.photo_url
      ? await this.generateSignedUrl(userClient, row.photo_url)
      : null;

    return this.mapRowToDto(row, signedUrl);
  }

  /**
   * PATCH /api/studios/therapists/:id/status — deactivates or reactivates.
   *
   * @param userId       auth.uid()
   * @param jwt          raw JWT
   * @param therapistId  UUID of the therapist
   * @param dto          validated UpdateTherapistStatusDto
   */
  async updateTherapistStatus(
    userId: string,
    jwt: string,
    therapistId: string,
    dto: UpdateTherapistStatusDto,
  ): Promise<TherapistResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    const { data, error } = await userClient
      .from('therapists')
      .update({ status: dto.status })
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .single();

    if (error || !data) {
      this.logger.warn(
        `Therapist not found or not owned for status update: therapistId=${therapistId} studioId=${studioId}`,
      );
      throw new NotFoundException('Therapist not found');
    }

    const row = data as TherapistRow;
    const signedUrl = row.photo_url
      ? await this.generateSignedUrl(userClient, row.photo_url)
      : null;

    return this.mapRowToDto(row, signedUrl);
  }

  /**
   * POST /api/studios/therapists/:id/photo — uploads or replaces a therapist photo.
   *
   * Processing pipeline (per architecture §12d):
   *  1. Reads current photo_url (for cleanup after successful upload).
   *  2. Runs the Sharp pipeline: resize to 600x600 max (inside, no upscale), WebP 80%.
   *  3. Uploads to 'therapist-photos' bucket at therapists/{therapistId}/{uuid}.webp.
   *  4. Updates therapists.photo_url to the new path.
   *  5. Deletes old path (non-fatal if it fails).
   *  6. Generates a signed URL for the response.
   *
   * Ownership enforced via:
   *  - resolveStudioId (studio_id FK check via studio_profiles)
   *  - user-scoped client (Storage RLS applies)
   *
   * @param userId       auth.uid()
   * @param jwt          raw JWT
   * @param therapistId  UUID of the therapist
   * @param file         Multer file buffer (already validated by ParseFilePipe)
   */
  async uploadTherapistPhoto(
    userId: string,
    jwt: string,
    therapistId: string,
    file: Express.Multer.File,
  ): Promise<TherapistResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch current row to (a) verify ownership and (b) get old photo_url for cleanup.
    const { data: currentData, error: fetchError } = await userClient
      .from('therapists')
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .single();

    if (fetchError || !currentData) {
      this.logger.warn(
        `Therapist not found for photo upload: therapistId=${therapistId} studioId=${studioId}`,
      );
      throw new NotFoundException('Therapist not found');
    }

    const currentRow = currentData as TherapistRow;
    const oldPhotoPath = currentRow.photo_url;

    // Run Sharp pipeline: resize to 600x600 max, encode as WebP at quality 80.
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(file.buffer)
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (err) {
      this.logger.error(
        `Sharp processing failed for therapistId=${therapistId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new InternalServerErrorException('Failed to process photo');
    }

    // Generate new Storage path: therapists/{therapistId}/{uuid}.webp
    const newPath = `therapists/${therapistId}/${randomUUID()}.webp`;

    // Upload to Storage (user-scoped client — Storage RLS applies).
    const { error: uploadError } = await userClient.storage
      .from(STORAGE_BUCKET)
      .upload(newPath, processedBuffer, { contentType: 'image/webp', upsert: false });

    if (uploadError) {
      this.logger.error(
        `Storage upload failed for therapistId=${therapistId}: ${uploadError.message}`,
      );
      throw new InternalServerErrorException('Failed to upload photo');
    }

    // Update the therapist row with the new photo path.
    const { data: updatedData, error: updateError } = await userClient
      .from('therapists')
      .update({ photo_url: newPath })
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .single();

    if (updateError || !updatedData) {
      this.logger.error(
        `Failed to update photo_url for therapistId=${therapistId}: ${updateError?.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to update therapist record after photo upload',
      );
    }

    // Delete old photo (non-fatal — log + continue on failure).
    if (oldPhotoPath) {
      const { error: deleteError } = await userClient.storage
        .from(STORAGE_BUCKET)
        .remove([oldPhotoPath]);
      if (deleteError) {
        this.logger.warn(
          `Non-fatal: failed to delete old photo for therapistId=${therapistId}: ${deleteError.message}`,
        );
      }
    }

    // Generate signed URL for the new photo.
    const signedUrl = await this.generateSignedUrl(userClient, newPath);

    return this.mapRowToDto(updatedData as TherapistRow, signedUrl);
  }

  /**
   * DELETE /api/studios/therapists/:id/photo — removes the therapist's photo.
   *
   * Idempotent: if photo_url is already null, returns 200 immediately.
   * Deletes the Storage object (non-fatal on failure) then sets photo_url = null.
   *
   * @param userId       auth.uid()
   * @param jwt          raw JWT
   * @param therapistId  UUID of the therapist
   */
  async removeTherapistPhoto(
    userId: string,
    jwt: string,
    therapistId: string,
  ): Promise<TherapistResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch current row.
    const { data: currentData, error: fetchError } = await userClient
      .from('therapists')
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .single();

    if (fetchError || !currentData) {
      this.logger.warn(
        `Therapist not found for photo removal: therapistId=${therapistId} studioId=${studioId}`,
      );
      throw new NotFoundException('Therapist not found');
    }

    const currentRow = currentData as TherapistRow;

    // Idempotent: already no photo.
    if (!currentRow.photo_url) {
      return this.mapRowToDto(currentRow, null);
    }

    const photoPath = currentRow.photo_url;

    // Delete Storage object (non-fatal).
    const { error: deleteError } = await userClient.storage
      .from(STORAGE_BUCKET)
      .remove([photoPath]);
    if (deleteError) {
      this.logger.warn(
        `Non-fatal: failed to delete photo for therapistId=${therapistId}: ${deleteError.message}`,
      );
    }

    // Clear photo_url in the DB.
    const { data: updatedData, error: updateError } = await userClient
      .from('therapists')
      .update({ photo_url: null })
      .eq('id', therapistId)
      .eq('studio_id', studioId)
      .select(
        'id, studio_id, name, role, phone, email, notes, photo_url, status, created_at, updated_at',
      )
      .single();

    if (updateError || !updatedData) {
      this.logger.error(
        `Failed to clear photo_url for therapistId=${therapistId}: ${updateError?.message}`,
      );
      throw new InternalServerErrorException('Failed to remove photo record');
    }

    return this.mapRowToDto(updatedData as TherapistRow, null);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Creates a per-request user-scoped Supabase client (anon key + JWT).
   *
   * RLS policies on therapists and storage.objects use auth.uid() derived
   * from this JWT to enforce that owners can only access their own data.
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
   * Generates a single signed URL for a Storage object path.
   *
   * Used for individual update/status/photo responses. For list responses
   * use buildSignedUrlMap() to batch the calls.
   */
  private async generateSignedUrl(
    userClient: SupabaseClient,
    path: string,
  ): Promise<string | null> {
    const { data, error } = await userClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      // Path is intentionally omitted from the log per architecture §9 (PII policy).
      this.logger.warn(`Failed to generate signed URL (path omitted): ${error?.message}`);
      return null;
    }

    return data.signedUrl;
  }

  /**
   * Builds a map of therapist UUID → signed URL for all rows with a photo_url.
   *
   * Uses createSignedUrls (batch) instead of createSignedUrl (per-item) to
   * avoid N Storage API calls per list render.
   *
   * Returns an empty Map when no rows have photos.
   */
  private async buildSignedUrlMap(
    userClient: SupabaseClient,
    rows: TherapistRow[],
  ): Promise<Map<string, string>> {
    const rowsWithPhotos = rows.filter((r) => r.photo_url !== null);
    const resultMap = new Map<string, string>();

    if (rowsWithPhotos.length === 0) {
      return resultMap;
    }

    const paths = rowsWithPhotos.map((r) => r.photo_url as string);

    const { data, error } = await userClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);

    if (error || !data) {
      this.logger.warn(`Failed to batch-generate signed URLs: ${error?.message}`);
      // Non-fatal: return empty map; rows will have null photoUrl.
      return resultMap;
    }

    // Build a path → signedUrl lookup, then map back to therapist UUIDs.
    const pathToUrl = new Map<string, string>(
      data
        .filter((item) => item.signedUrl)
        .map((item) => [item.path, item.signedUrl] as [string, string]),
    );

    for (const row of rowsWithPhotos) {
      const signedUrl = pathToUrl.get(row.photo_url as string);
      if (signedUrl) {
        resultMap.set(row.id, signedUrl);
      }
    }

    return resultMap;
  }

  /**
   * Maps a DB row to the API response DTO.
   *
   * signedUrl replaces photo_url in the response — the raw Storage path
   * is never returned to clients.
   */
  private mapRowToDto(row: TherapistRow, signedUrl: string | null): TherapistResponseDto {
    return {
      id: row.id,
      studioId: row.studio_id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      photoUrl: signedUrl,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
