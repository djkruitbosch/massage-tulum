import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SupabaseJwtGuard, JwtRequest } from '../common/guards/supabase-jwt.guard';
import { TherapistsService } from './therapists.service';
import { CreateTherapistDto } from './dto/create-therapist.dto';
import { UpdateTherapistDto } from './dto/update-therapist.dto';
import { UpdateTherapistStatusDto } from './dto/update-therapist-status.dto';
import { TherapistResponseDto } from './dto/therapist-response.dto';
import { UploadPhotoResponseDto } from './dto/upload-photo-response.dto';

/**
 * TherapistsController
 *
 * All 6 endpoints for the therapist roster feature.
 * All require a valid Supabase JWT (SupabaseJwtGuard).
 * The studio_id is resolved from the JWT — never accepted from the request body.
 *
 * Endpoints:
 *   GET    /api/studios/therapists                — list (filter: ?status=active|inactive|all)
 *   POST   /api/studios/therapists                — create
 *   PATCH  /api/studios/therapists/:id            — update fields
 *   PATCH  /api/studios/therapists/:id/status     — deactivate / reactivate
 *   POST   /api/studios/therapists/:id/photo      — upload/replace photo (multipart)
 *   DELETE /api/studios/therapists/:id/photo      — remove photo
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4
 */
@ApiTags('therapists')
@Controller('studios/therapists')
@UseGuards(SupabaseJwtGuard)
@ApiBearerAuth()
export class TherapistsController {
  constructor(private readonly therapistsService: TherapistsService) {}

  // ─── GET /api/studios/therapists ────────────────────────────────────────────

  /**
   * GET /api/studios/therapists
   *
   * Returns all therapists for the authenticated studio, ordered by name ASC.
   * photoUrl in the response is a signed URL (1-hour TTL) generated server-side.
   * Null photoUrl means no photo has been uploaded — the FE renders an initials avatar.
   *
   * Query params:
   *   ?status=active  — active therapists only
   *   ?status=inactive — inactive therapists only
   *   ?status=all     — all therapists (default)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List therapists for the authenticated studio',
    description:
      'Returns all therapists ordered by name ASC. ' +
      'photoUrl is a server-generated signed URL (1-hour TTL) or null. ' +
      'Signed URLs are generated in a single batch Storage API call.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'all'],
    description: "Filter by therapist status. Defaults to 'all'.",
  })
  @ApiOkResponse({
    description: 'Array of therapists (empty array if none)',
    type: [TherapistResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async listTherapists(
    @Req() req: JwtRequest,
    @Query('status') status?: 'active' | 'inactive' | 'all',
  ): Promise<TherapistResponseDto[]> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.listTherapists(req.userId, jwt, status ?? 'all');
  }

  // ─── POST /api/studios/therapists ────────────────────────────────────────────

  /**
   * POST /api/studios/therapists
   *
   * Creates a new therapist for the authenticated studio.
   * studio_id is resolved from the JWT — not accepted in the request body.
   * Returns 201 + the created therapist (photoUrl will be null — photos
   * are uploaded separately via POST /photo after the therapist is created).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new therapist',
    description:
      'Creates a therapist for the authenticated studio. ' +
      'studio_id is resolved from the JWT. ' +
      'Photo upload is a separate step: POST /api/studios/therapists/:id/photo',
  })
  @ApiCreatedResponse({
    description: 'Therapist created (photoUrl is null — upload photo separately)',
    type: TherapistResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failure (field-level errors)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async createTherapist(
    @Req() req: JwtRequest,
    @Body() dto: CreateTherapistDto,
  ): Promise<TherapistResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.createTherapist(req.userId, jwt, dto);
  }

  // ─── PATCH /api/studios/therapists/:id ───────────────────────────────────────

  /**
   * PATCH /api/studios/therapists/:id
   *
   * Partial update of therapist fields. Any subset of fields may be provided.
   * Cannot update status here — use PATCH /api/studios/therapists/:id/status.
   * Returns 404 if the therapist does not exist or belongs to a different studio
   * (avoids information leakage per architecture §4e).
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update therapist fields',
    description:
      'Partial update. At least one field must be provided. ' +
      'Cannot update status (use the dedicated /status endpoint). ' +
      'Returns 404 for cross-studio attempts to avoid info leakage.',
  })
  @ApiOkResponse({ description: 'Updated therapist', type: TherapistResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or no fields provided' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Therapist not found or not owned by this studio' })
  async updateTherapist(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTherapistDto,
  ): Promise<TherapistResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.updateTherapist(req.userId, jwt, id, dto);
  }

  // ─── PATCH /api/studios/therapists/:id/status ────────────────────────────────

  /**
   * PATCH /api/studios/therapists/:id/status
   *
   * Deactivates (status='inactive') or reactivates (status='active') a therapist.
   * Status transitions are semantically distinct from field edits — separate endpoint
   * allows different UX flows and future business rules (e.g. booking checks in v2).
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update therapist status (deactivate / reactivate)',
    description:
      "Sets the therapist's status to 'active' or 'inactive'. " +
      'Deactivated therapists will not appear in booking flows. ' +
      'This is a soft-deactivation only (ADR-0013) — the row is retained.',
  })
  @ApiOkResponse({ description: 'Updated therapist with new status', type: TherapistResponseDto })
  @ApiBadRequestResponse({ description: "Invalid status value (must be 'active' or 'inactive')" })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Therapist not found or not owned by this studio' })
  async updateTherapistStatus(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTherapistStatusDto,
  ): Promise<TherapistResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.updateTherapistStatus(req.userId, jwt, id, dto);
  }

  // ─── POST /api/studios/therapists/:id/photo ───────────────────────────────────

  /**
   * POST /api/studios/therapists/:id/photo
   *
   * Uploads or replaces a therapist photo.
   *
   * Accepts: multipart/form-data, field name = 'file'.
   * Validates:
   *   - Magic bytes (FileTypeValidator): image/jpeg, image/png, or image/webp only.
   *     This checks actual file bytes, not just the client-reported MIME type.
   *   - Max size (MaxFileSizeValidator): 5 MB (5,242,880 bytes).
   *
   * Processing (Sharp pipeline per architecture §12d):
   *   resize(600x600, fit=inside, withoutEnlargement) → webp(quality=80)
   *
   * Upload path: therapists/{therapist_id}/{uuid}.webp
   * Old photo (if any) is deleted after successful upload (non-fatal on failure).
   *
   * Returns 200 + updated therapist with a signed URL for the new photo.
   *
   * Security:
   *   - File never touches disk (Multer memory storage).
   *   - Upload uses the user-scoped Supabase client (Storage RLS enforced).
   *   - Raw Storage path is never returned to the client.
   */
  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload or replace therapist photo',
    description:
      'Accepts a JPEG, PNG, or WebP image (max 5 MB). ' +
      'Magic bytes are validated server-side (not just the MIME header). ' +
      'The image is resized to max 600x600 and re-encoded as WebP before storage. ' +
      'The raw Storage path is never returned — photoUrl in the response is a signed URL.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Photo file (JPEG, PNG, or WebP; max 5 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    description: 'Updated therapist with signed URL for the new photo',
    type: UploadPhotoResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'File missing, too large (>5 MB), or wrong type (not JPEG/PNG/WebP)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Therapist not found or not owned by this studio' })
  async uploadPhoto(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<TherapistResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.uploadTherapistPhoto(req.userId, jwt, id, file);
  }

  // ─── DELETE /api/studios/therapists/:id/photo ─────────────────────────────────

  /**
   * DELETE /api/studios/therapists/:id/photo
   *
   * Removes a therapist's photo. Idempotent — safe to call even if no photo exists.
   * The Storage object is deleted (non-fatal if deletion fails), then photo_url is
   * set to null in the DB.
   *
   * Returns 200 + updated therapist (photoUrl = null).
   */
  @Delete(':id/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove therapist photo',
    description:
      'Removes the therapist photo and clears photo_url. ' +
      'Idempotent — returns 200 even if no photo was set. ' +
      'Storage object deletion is best-effort (failure is logged, not surfaced to the caller).',
  })
  @ApiOkResponse({
    description: 'Updated therapist with photoUrl = null',
    type: TherapistResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Therapist not found or not owned by this studio' })
  async removePhoto(
    @Req() req: JwtRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<TherapistResponseDto> {
    const jwt = req.headers['authorization']!.slice(7);
    return this.therapistsService.removeTherapistPhoto(req.userId, jwt, id);
  }
}
