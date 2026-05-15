import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseJwtGuard, JwtRequest } from '../common/guards/supabase-jwt.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FutureBookingsCountDto, ServiceResponseDto } from './dto/service-response.dto';

/**
 * ServicesController
 *
 * All 7 endpoints for the service catalog feature.
 * All require a valid Supabase JWT (SupabaseJwtGuard).
 * The studio_id is resolved from the JWT — never accepted from the request body.
 *
 * Endpoints:
 *   GET    /api/studios/services                              — list (filter: ?status=active|inactive|all)
 *   GET    /api/studios/services/categories                   — distinct categories for the studio
 *   POST   /api/studios/services                              — create
 *   PATCH  /api/studios/services/:id                         — partial update
 *   GET    /api/studios/services/:id/future-bookings-count   — preflight for deactivation dialog
 *   POST   /api/studios/services/:id/deactivate              — set status=inactive
 *   POST   /api/studios/services/:id/reactivate              — set status=active
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4
 *      docs/adr/0011-studio-scoped-resource-pattern.md
 */
@ApiTags('services')
@Controller('studios/services')
@UseGuards(SupabaseJwtGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ─── GET /api/studios/services ───────────────────────────────────────────────

  /**
   * GET /api/studios/services
   *
   * Lists services for the authenticated studio, ordered by name ASC.
   * Default filter is 'active'. Use ?status=all to retrieve all.
   * Empty array is returned (not 404) when no matching services exist.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List services for the authenticated studio',
    description:
      'Returns services ordered by name ASC. ' +
      'Default filter is active. ' +
      "Analytics event 'service_catalog_viewed' is emitted with unfiltered active/inactive counts.",
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'all'],
    description: "Filter by service status. Defaults to 'active'.",
  })
  @ApiOkResponse({
    description: 'Array of services matching the filter (empty array if none)',
    type: [ServiceResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async listServices(
    @Req() req: JwtRequest,
    @Query('status') status?: 'active' | 'inactive' | 'all',
  ): Promise<ServiceResponseDto[]> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.listServices(req.userId, jwt, status ?? 'active');
  }

  // ─── GET /api/studios/services/categories ────────────────────────────────────

  /**
   * GET /api/studios/services/categories
   *
   * Returns distinct non-null category labels for the studio, sorted alphabetically.
   * Used by the CategoryCombobox to populate the dropdown.
   * Empty array if no services have categories assigned.
   *
   * NOTE: This route must be declared before /:id to avoid NestJS treating
   * 'categories' as a UUID parameter.
   */
  @Get('categories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List distinct service categories for the authenticated studio',
    description:
      'Returns distinct non-null category labels sorted alphabetically. ' +
      'Used by the CategoryCombobox — fetched lazily on first focus.',
  })
  @ApiOkResponse({
    description: 'Alphabetically sorted array of category strings (empty array if none)',
    schema: {
      type: 'array',
      items: { type: 'string', example: 'Relajación' },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async listCategories(@Req() req: JwtRequest): Promise<string[]> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.listCategories(req.userId, jwt);
  }

  // ─── POST /api/studios/services ──────────────────────────────────────────────

  /**
   * POST /api/studios/services
   *
   * Creates a new service for the authenticated studio.
   * studio_id is resolved from the JWT — not accepted in the request body.
   * Returns 201 + the created ServiceResponseDto.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new service',
    description:
      'Creates a service for the authenticated studio. ' +
      'studio_id is resolved from the JWT. ' +
      "name is trimmed before save. Emits 'service_created' analytics event.",
  })
  @ApiCreatedResponse({
    description: 'Service created successfully',
    type: ServiceResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failure (field-level errors) — 422' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async createService(
    @Req() req: JwtRequest,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.createService(req.userId, jwt, dto);
  }

  // ─── PATCH /api/studios/services/:id ─────────────────────────────────────────

  /**
   * PATCH /api/studios/services/:id
   *
   * Partial update of service fields. Any subset of fields may be provided.
   * At least one field must be present (service throws 400 if all are undefined).
   * Returns 404 for cross-studio access attempts to avoid info leakage (ADR-0011).
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update service fields',
    description:
      'Partial update — at least one field must be provided. ' +
      'Can update active or inactive services. ' +
      'Returns 404 for cross-studio attempts to avoid info leakage (ADR-0011). ' +
      "Emits 'service_edited' with fields_changed array.",
  })
  @ApiOkResponse({ description: 'Updated service', type: ServiceResponseDto })
  @ApiBadRequestResponse({ description: 'No fields provided (400) or validation failure (422)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Service not found or not owned by this studio' })
  async updateService(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.updateService(req.userId, jwt, id, dto);
  }

  // ─── GET /api/studios/services/:id/future-bookings-count ─────────────────────

  /**
   * GET /api/studios/services/:id/future-bookings-count
   *
   * Preflight endpoint for the deactivation confirmation dialog.
   * Returns the count of future confirmed/pending bookings for this service.
   *
   * Always returns 0 in v1 (bookings table not yet created).
   * The API contract (response shape) is stable — implementation will be updated
   * when the bookings module is implemented.
   */
  @Get(':id/future-bookings-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get future bookings count for a service (deactivation preflight)',
    description:
      'Returns the count of future confirmed/pending bookings for this service. ' +
      'Fetched at dialog-open time so the FE can show a warning before deactivating. ' +
      'Always returns 0 in v1 (bookings table not yet created).',
  })
  @ApiOkResponse({
    description: 'Future bookings count (always 0 in v1)',
    type: FutureBookingsCountDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Service not found or not owned by this studio' })
  async getFutureBookingsCount(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<FutureBookingsCountDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.getFutureBookingsCount(req.userId, jwt, id);
  }

  // ─── POST /api/studios/services/:id/deactivate ───────────────────────────────

  /**
   * POST /api/studios/services/:id/deactivate
   *
   * Flips service status to 'inactive'.
   * Returns 409 if the service is already inactive.
   * Returns 404 if the service does not exist or belongs to another studio.
   */
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a service',
    description:
      "Sets the service status to 'inactive'. " +
      'Deactivated services will not appear in active-only listing or customer booking flows. ' +
      'Soft-deactivation only — the row is retained. ' +
      "Returns 409 if already inactive (error: 'service_already_inactive').",
  })
  @ApiOkResponse({
    description: "Updated service with status='inactive'",
    type: ServiceResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Service not found or not owned by this studio' })
  @ApiConflictResponse({
    description: "Service is already inactive — { error: 'service_already_inactive' }",
  })
  async deactivateService(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ServiceResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.deactivateService(req.userId, jwt, id);
  }

  // ─── POST /api/studios/services/:id/reactivate ───────────────────────────────

  /**
   * POST /api/studios/services/:id/reactivate
   *
   * Flips service status to 'active'.
   * Returns 409 if the service is already active.
   * Returns 404 if the service does not exist or belongs to another studio.
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate a service',
    description:
      "Sets the service status to 'active'. " +
      "Returns 409 if already active (error: 'service_already_active').",
  })
  @ApiOkResponse({
    description: "Updated service with status='active'",
    type: ServiceResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Service not found or not owned by this studio' })
  @ApiConflictResponse({
    description: "Service is already active — { error: 'service_already_active' }",
  })
  async reactivateService(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ServiceResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.servicesService.reactivateService(req.userId, jwt, id);
  }
}
