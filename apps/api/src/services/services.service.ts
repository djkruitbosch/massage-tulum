import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { StudioResolverService } from '../common/services/studio-resolver.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FutureBookingsCountDto, ServiceResponseDto } from './dto/service-response.dto';

// ─── Row types (Postgres snake_case) ─────────────────────────────────────────

interface ServiceRow {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  base_price_mxn: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

type ServiceStatusFilter = 'active' | 'inactive' | 'all';

const SERVICE_SELECT =
  'id, studio_id, name, description, category, duration_minutes, base_price_mxn, status, created_at, updated_at';

/**
 * ServicesService — CRUD, status management, and analytics for the service catalog.
 *
 * Studio ownership is resolved via StudioResolverService (shared provider).
 * All other reads/writes use a per-request user-scoped client (anon key + JWT)
 * so that RLS enforces studio ownership on every DB operation.
 *
 * studio_id is never accepted from the request body — always resolved from
 * the authenticated user's JWT sub claim via StudioResolverService.
 *
 * Analytics are emitted via Logger (stub for v1 — no analytics sink provisioned).
 *
 * PII policy: service name, description, and category are NEVER logged.
 * Log only serviceId and studioId (UUIDs) for correlation.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4, §5
 *      docs/adr/0011-studio-scoped-resource-pattern.md
 */
@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly studioResolver: StudioResolverService) {}

  // ─── Public methods ──────────────────────────────────────────────────────────

  /**
   * GET /api/studios/services — lists services for the authenticated studio.
   *
   * Fetches the full unfiltered list first to compute active/inactive counts for
   * analytics, then applies the requested filter for the response.
   *
   * @param userId  auth.uid() from the verified JWT sub claim
   * @param jwt     raw JWT for user-scoped Supabase client
   * @param status  'active' | 'inactive' | 'all' (default: 'active')
   */
  async listServices(
    userId: string,
    jwt: string,
    status: ServiceStatusFilter = 'active',
  ): Promise<ServiceResponseDto[]> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch all services first to get unfiltered counts for analytics.
    const { data: allData, error: allError } = await userClient
      .from('services')
      .select(SERVICE_SELECT)
      .eq('studio_id', studioId)
      .order('name', { ascending: true });

    if (allError) {
      this.logger.error(`Failed to list services for studioId=${studioId}: ${allError.message}`);
      throw new InternalServerErrorException('Failed to retrieve services');
    }

    const allRows = (allData ?? []) as ServiceRow[];
    const activeCount = allRows.filter((r) => r.status === 'active').length;
    const inactiveCount = allRows.filter((r) => r.status === 'inactive').length;

    // Emit analytics event with full counts, regardless of filter.
    this.trackEvent('service_catalog_viewed', {
      studio_id: studioId,
      active_count: activeCount,
      inactive_count: inactiveCount,
      filter_applied: status,
    });

    // Apply the requested filter in memory (avoids a second DB round-trip).
    const filteredRows = status === 'all' ? allRows : allRows.filter((r) => r.status === status);

    return filteredRows.map((row) => this.mapRowToDto(row));
  }

  /**
   * GET /api/studios/services/categories — returns distinct non-null categories.
   *
   * Categories are derived from DISTINCT category WHERE studio_id = $1 AND category IS NOT NULL.
   * Sorted alphabetically. Empty array if no categories have been assigned.
   *
   * @param userId  auth.uid()
   * @param jwt     raw JWT
   */
  async listCategories(userId: string, jwt: string): Promise<string[]> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    const { data, error } = await userClient
      .from('services')
      .select('category')
      .eq('studio_id', studioId)
      .not('category', 'is', null);

    if (error) {
      this.logger.error(`Failed to list categories for studioId=${studioId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve categories');
    }

    const rows = (data ?? []) as { category: string | null }[];
    const uniqueCategories = [
      ...new Set(rows.map((r) => r.category).filter((c): c is string => c !== null)),
    ].sort();

    return uniqueCategories;
  }

  /**
   * POST /api/studios/services — creates a new service.
   *
   * studio_id is resolved from the JWT; not accepted from the request body.
   * name is trimmed before save. description/category null coalescing happens here.
   *
   * @param userId  auth.uid()
   * @param jwt     raw JWT
   * @param dto     validated CreateServiceDto
   */
  async createService(
    userId: string,
    jwt: string,
    dto: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    const insertPayload = {
      studio_id: studioId,
      name: dto.name.trim(),
      description: dto.description ?? null,
      category: dto.category ?? null,
      duration_minutes: dto.durationMinutes,
      base_price_mxn: dto.basePriceMxn,
    };

    const { data, error } = await userClient
      .from('services')
      .insert(insertPayload)
      .select(SERVICE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to create service for studioId=${studioId}: ${error?.message}`);
      throw new InternalServerErrorException('Failed to create service');
    }

    const row = data as ServiceRow;

    this.trackEvent('service_created', {
      studio_id: studioId,
      service_id: row.id,
      duration_minutes: row.duration_minutes,
      base_price_mxn: row.base_price_mxn,
      has_category: row.category !== null,
      has_description: row.description !== null,
    });

    return this.mapRowToDto(row);
  }

  /**
   * PATCH /api/studios/services/:id — partial update of service fields.
   *
   * At least one field must be provided. If no fields are provided, throws
   * BadRequestException (400) before touching the DB.
   *
   * Cross-studio access: user-scoped client returns zero rows → NotFoundException (404).
   *
   * @param userId     auth.uid()
   * @param jwt        raw JWT
   * @param serviceId  UUID of the service to update
   * @param dto        validated UpdateServiceDto
   */
  async updateService(
    userId: string,
    jwt: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    // At least one field must be provided.
    const providedKeys = (Object.keys(dto) as (keyof UpdateServiceDto)[]).filter(
      (k) => dto[k] !== undefined,
    );
    if (providedKeys.length === 0) {
      throw new BadRequestException('At least one field must be provided for update');
    }

    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Build update payload from only the provided fields.
    const updatePayload: Partial<{
      name: string;
      description: string | null;
      category: string | null;
      duration_minutes: number;
      base_price_mxn: number;
    }> = {};

    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.description !== undefined) updatePayload.description = dto.description ?? null;
    if (dto.category !== undefined) updatePayload.category = dto.category ?? null;
    if (dto.durationMinutes !== undefined) updatePayload.duration_minutes = dto.durationMinutes;
    if (dto.basePriceMxn !== undefined) updatePayload.base_price_mxn = dto.basePriceMxn;

    const { data, error } = await userClient
      .from('services')
      .update(updatePayload)
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .select(SERVICE_SELECT)
      .single();

    if (error || !data) {
      // RLS blocks cross-studio updates (zero rows) — return 404 to avoid info leakage.
      this.logger.warn(
        `Service not found or not owned: serviceId=${serviceId} studioId=${studioId}`,
      );
      throw new NotFoundException('Service not found');
    }

    const row = data as ServiceRow;

    this.trackEvent('service_edited', {
      studio_id: studioId,
      service_id: row.id,
      fields_changed: providedKeys,
    });

    return this.mapRowToDto(row);
  }

  /**
   * GET /api/studios/services/:id/future-bookings-count — preflight for deactivation.
   *
   * Always returns 0 in v1 (bookings table does not exist yet).
   * When the bookings module is implemented, this method will be updated to run
   * the actual count query. The API contract (shape of the response) is stable.
   *
   * @param userId     auth.uid()
   * @param jwt        raw JWT
   * @param serviceId  UUID of the service
   */
  async getFutureBookingsCount(
    userId: string,
    jwt: string,
    serviceId: string,
  ): Promise<FutureBookingsCountDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Verify the service exists and belongs to this studio (ownership check).
    const { data, error } = await userClient
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .single();

    if (error || !data) {
      this.logger.warn(
        `Service not found for future-bookings-count: serviceId=${serviceId} studioId=${studioId}`,
      );
      throw new NotFoundException('Service not found');
    }

    // v1: bookings table does not exist yet — always return 0.
    return { futureBookingsCount: 0 };
  }

  /**
   * POST /api/studios/services/:id/deactivate — sets status to 'inactive'.
   *
   * Returns 409 if the service is already inactive.
   * Returns 404 if the service does not exist or belongs to another studio.
   *
   * @param userId     auth.uid()
   * @param jwt        raw JWT
   * @param serviceId  UUID of the service to deactivate
   */
  async deactivateService(
    userId: string,
    jwt: string,
    serviceId: string,
  ): Promise<ServiceResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch current row to check status before updating.
    const { data: currentData, error: fetchError } = await userClient
      .from('services')
      .select(SERVICE_SELECT)
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .single();

    if (fetchError || !currentData) {
      this.logger.warn(
        `Service not found for deactivation: serviceId=${serviceId} studioId=${studioId}`,
      );
      throw new NotFoundException('Service not found');
    }

    const currentRow = currentData as ServiceRow;

    if (currentRow.status === 'inactive') {
      throw new ConflictException('service_already_inactive');
    }

    const { data, error } = await userClient
      .from('services')
      .update({ status: 'inactive' })
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .select(SERVICE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to deactivate service: serviceId=${serviceId} studioId=${studioId}: ${error?.message}`,
      );
      throw new InternalServerErrorException('Failed to deactivate service');
    }

    const row = data as ServiceRow;

    this.trackEvent('service_deactivated', {
      studio_id: studioId,
      service_id: row.id,
      // v1: bookings table doesn't exist yet — always false/0.
      had_future_bookings: false,
      future_booking_count: 0,
    });

    return this.mapRowToDto(row);
  }

  /**
   * POST /api/studios/services/:id/reactivate — sets status to 'active'.
   *
   * Returns 409 if the service is already active.
   * Returns 404 if the service does not exist or belongs to another studio.
   *
   * @param userId     auth.uid()
   * @param jwt        raw JWT
   * @param serviceId  UUID of the service to reactivate
   */
  async reactivateService(
    userId: string,
    jwt: string,
    serviceId: string,
  ): Promise<ServiceResponseDto> {
    const studioId = await this.studioResolver.resolveStudioId(userId);
    const userClient = this.buildUserClient(jwt);

    // Fetch current row to check status before updating.
    const { data: currentData, error: fetchError } = await userClient
      .from('services')
      .select(SERVICE_SELECT)
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .single();

    if (fetchError || !currentData) {
      this.logger.warn(
        `Service not found for reactivation: serviceId=${serviceId} studioId=${studioId}`,
      );
      throw new NotFoundException('Service not found');
    }

    const currentRow = currentData as ServiceRow;

    if (currentRow.status === 'active') {
      throw new ConflictException('service_already_active');
    }

    const { data, error } = await userClient
      .from('services')
      .update({ status: 'active' })
      .eq('id', serviceId)
      .eq('studio_id', studioId)
      .select(SERVICE_SELECT)
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to reactivate service: serviceId=${serviceId} studioId=${studioId}: ${error?.message}`,
      );
      throw new InternalServerErrorException('Failed to reactivate service');
    }

    const row = data as ServiceRow;

    this.trackEvent('service_reactivated', {
      studio_id: studioId,
      service_id: row.id,
    });

    return this.mapRowToDto(row);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Creates a per-request user-scoped Supabase client (anon key + JWT).
   *
   * RLS policies on services use auth.uid() derived from this JWT to enforce
   * that owners can only access their own studio's data.
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
   * Emits an analytics event via Logger (v1 stub).
   *
   * PII policy: service name, description, and category are NEVER included.
   * Only UUIDs and numeric/boolean properties are logged.
   *
   * When a real analytics sink (Mixpanel, Segment, etc.) is provisioned in v2+,
   * replace the Logger call with the sink client while preserving the call sites.
   *
   * See: docs/architecture/CU-869d29f21-service-catalog.md §5
   */
  private trackEvent(event: string, properties: Record<string, unknown>): void {
    this.logger.log(`[analytics] ${event} ${JSON.stringify(properties)}`);
  }

  /**
   * Maps a DB row (snake_case) to the API response DTO (camelCase).
   */
  private mapRowToDto(row: ServiceRow): ServiceResponseDto {
    return {
      id: row.id,
      studioId: row.studio_id,
      name: row.name,
      description: row.description,
      category: row.category,
      durationMinutes: row.duration_minutes,
      basePriceMxn: row.base_price_mxn,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
