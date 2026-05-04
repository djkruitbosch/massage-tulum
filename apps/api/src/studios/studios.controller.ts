import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { StudiosService } from './studios.service';
import { CreatePendingStudioDto } from './dto/create-pending-studio.dto';
import { RejectStudioDto } from './dto/reject-studio.dto';
import { ListPendingStudiosDto } from './dto/list-pending-studios.dto';
import { AdminGuard } from './guards/admin.guard';

/** Shape attached to the request by AdminGuard */
interface AdminRequest extends Request {
  adminUserId: string;
  adminEmails: string[];
}

/**
 * StudiosController
 *
 * Endpoints:
 *   POST /api/studios/signup                    — public, rate-limited (3/60s/IP)
 *   GET  /api/admin/pending-studios             — admin only
 *   POST /api/admin/pending-studios/:id/approve — admin only
 *   POST /api/admin/pending-studios/:id/reject  — admin only
 *
 * PUBLIC ENDPOINTS — /api/studios/signup:
 *   Public (no auth required). Rate-limited to 3 requests per 60 s per IP via
 *   @nestjs/throttler. Reviewer approval per CLAUDE.md: this endpoint creates
 *   a `pending_studios` row only — no auth user is created, no studio is
 *   activated. Anti-abuse is the throttler + NestJS layer (ADR-0008 §1).
 *
 * AC-22: Admin routes return 404 (not 403) for non-admin callers to avoid
 *   route discovery. ForbiddenException from AdminGuard is caught and re-thrown
 *   as NotFoundException in each admin action.
 */
@ApiTags('studios')
@Controller()
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  /**
   * POST /api/studios/signup
   *
   * Self-signup for studio owners. Creates a pending_studios row.
   * Does NOT create an auth.users row or activate any studio.
   * Rate-limited: 3 requests per 60 seconds per IP.
   * Duplicate emails are silently de-duplicated (AC-21 — no enumeration).
   */
  @Post('studios/signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Studio owner self-signup',
    description:
      'Creates a pending studio application. The studio is NOT active until an admin approves it. ' +
      'Rate-limited to 3 requests per 60 seconds per IP. ' +
      'Duplicate email submissions are silently accepted (no enumeration).',
  })
  @ApiCreatedResponse({
    description: 'Application received (or silently de-duplicated)',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', example: 'pending' } },
      example: { status: 'pending' },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (3 req / 60s / IP)' })
  async signup(@Body() dto: CreatePendingStudioDto): Promise<{ status: 'pending' }> {
    await this.studiosService.createPendingStudio(dto);
    return { status: 'pending' };
  }

  /**
   * GET /api/admin/pending-studios
   *
   * Lists pending studio applications. Admin only (JWT + ADMIN_EMAILS check).
   * Non-admin callers receive 404 (AC-22 — do not reveal route existence).
   */
  @Get('admin/pending-studios')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List pending studio applications',
    description: 'Admin-only. Returns paginated list of studio applications filtered by status.',
  })
  @ApiOkResponse({
    description: 'Paginated list of pending studios',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              studioName: { type: 'string' },
              contactPhone: { type: 'string', nullable: true },
              description: { type: 'string' },
              locale: { type: 'string', enum: ['es', 'en'] },
              status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
              submittedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Not found (non-admin callers receive 404 per AC-22)' })
  async listPendingStudios(@Query() query: ListPendingStudiosDto, @Req() req: AdminRequest) {
    try {
      return await this.studiosService.listPendingStudios(query, req.adminEmails);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw new NotFoundException();
      }
      throw err;
    }
  }

  /**
   * POST /api/admin/pending-studios/:id/approve
   *
   * Approves a pending studio application. Admin only.
   * Atomically creates studios + studio_profiles rows, marks pending row
   * approved, generates magic-link, and sends bilingual welcome email via Brevo.
   *
   * Returns 404 for non-admin (AC-22 — do not reveal route existence).
   */
  @Post('admin/pending-studios/:id/approve')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve a pending studio application',
    description:
      'Admin-only. Atomically creates the studio, studio profile, and auth user ' +
      '(if not already exists), then sends a bilingual welcome email with a magic-link.',
  })
  @ApiOkResponse({
    description: 'Studio approved',
    schema: {
      type: 'object',
      properties: {
        studioId: { type: 'string', format: 'uuid' },
        authUserId: { type: 'string', format: 'uuid' },
      },
      example: {
        studioId: '00000000-0000-0000-0000-000000000001',
        authUserId: '00000000-0000-0000-0000-000000000002',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Pending studio not found (or non-admin receives 404)' })
  @ApiConflictResponse({ description: 'Studio is already approved' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin (returns 404 per AC-22)' })
  async approvePendingStudio(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AdminRequest,
  ): Promise<{ studioId: string; authUserId: string }> {
    try {
      return await this.studiosService.approvePendingStudio(id, req.adminUserId, req.adminEmails);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw new NotFoundException();
      }
      throw err;
    }
  }

  /**
   * POST /api/admin/pending-studios/:id/reject
   *
   * Rejects a pending studio application. Admin only.
   * No email is sent to the applicant (silent rejection in v1 per spec §11).
   *
   * Returns 404 for non-admin (AC-22 — do not reveal route existence).
   */
  @Post('admin/pending-studios/:id/reject')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject a pending studio application',
    description:
      'Admin-only. Marks the application as rejected with an optional reason. ' +
      'No email is sent to the applicant in v1.',
  })
  @ApiOkResponse({
    description: 'Studio rejected',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', example: 'rejected' } },
      example: { status: 'rejected' },
    },
  })
  @ApiNotFoundResponse({ description: 'Pending studio not found (or non-admin receives 404)' })
  @ApiConflictResponse({ description: 'Studio is already rejected' })
  @ApiForbiddenResponse({ description: 'Caller is not an admin (returns 404 per AC-22)' })
  async rejectPendingStudio(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectStudioDto,
    @Req() req: AdminRequest,
  ): Promise<{ status: 'rejected' }> {
    try {
      await this.studiosService.rejectPendingStudio(id, dto, req.adminUserId, req.adminEmails);
      return { status: 'rejected' };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw new NotFoundException();
      }
      throw err;
    }
  }
}
