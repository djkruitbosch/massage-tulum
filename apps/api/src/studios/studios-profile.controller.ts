import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StudiosProfileService } from './studios-profile.service';
import { UpdateStudioProfileDto } from './dto/update-studio-profile.dto';
import { SupabaseJwtGuard, JwtRequest } from '../common/guards/supabase-jwt.guard';

/**
 * StudiosProfileController
 *
 * Endpoints for the authenticated studio owner to read and update their profile.
 *
 *   GET  /api/studios/profile  — returns studio name, address, phone, email, hours
 *   PATCH /api/studios/profile — partial update of profile fields and/or hours
 *
 * Both endpoints require a valid Supabase JWT (SupabaseJwtGuard).
 * RLS on public.studios and public.studio_hours enforces that owners can
 * only access their own studio's data.
 *
 * See: docs/architecture/CU-869d29f1h-studio-profile.md §3
 */
@ApiTags('studios')
@Controller('studios')
@UseGuards(SupabaseJwtGuard)
@ApiBearerAuth()
export class StudiosProfileController {
  constructor(private readonly profileService: StudiosProfileService) {}

  /**
   * GET /api/studios/profile
   *
   * Returns the authenticated studio owner's profile.
   *
   * The resolved studio is determined by the JWT sub claim → studio_profiles
   * lookup → studios row. Hours are included in the response.
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my studio profile',
    description:
      "Returns the authenticated studio owner's profile including name, address, " +
      'contact details, and business hours. All 7 weekdays are returned, ' +
      'including days where isOpen=false.',
  })
  @ApiOkResponse({
    description: 'Studio profile',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Tulum Wellness Studio' },
        address: {
          type: 'string',
          nullable: true,
          example: 'Av. Tulum, Centro, Tulum, Q.R.',
        },
        phone: {
          type: 'string',
          nullable: true,
          example: '+529841234567',
          description: 'E.164 format. Doubles as WhatsApp number.',
        },
        email: {
          type: 'string',
          nullable: true,
          example: 'hello@mystudio.com',
        },
        description: {
          type: 'string',
          nullable: true,
          maxLength: 500,
          example: 'Holistic massage therapy in the heart of Tulum.',
        },
        hours: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              weekday: {
                type: 'integer',
                minimum: 1,
                maximum: 7,
                description: '1=Monday … 7=Sunday',
              },
              isOpen: { type: 'boolean' },
              openTime: {
                type: 'string',
                nullable: true,
                example: '09:00',
                description: 'HH:MM (24h). Null when isOpen=false.',
              },
              closeTime: {
                type: 'string',
                nullable: true,
                example: '21:00',
                description: 'HH:MM (24h). Null when isOpen=false.',
              },
            },
          },
        },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async getMyProfile(@Req() req: JwtRequest) {
    const rawToken = req.headers['authorization']!.slice(7);
    return this.profileService.getMyProfile(req.userId, rawToken);
  }

  /**
   * PATCH /api/studios/profile
   *
   * Partial update of the studio profile. Any combination of fields may be
   * provided. When hours is included, all 7 weekdays must be provided
   * (full replacement — no partial hours update).
   *
   * Business rule: after applying the patch, the studio must have a name
   * and at least one contact method (phone or email).
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update my studio profile',
    description:
      "Partially updates the authenticated studio owner's profile. " +
      'When the hours field is included, all 7 weekday entries must be provided ' +
      '(atomic full-replacement, not partial). ' +
      'After the update, the studio must have a name and at least one of phone/email.',
  })
  @ApiOkResponse({
    description: 'Updated studio profile (same shape as GET /api/studios/profile)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        address: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true, maxLength: 500 },
        hours: { type: 'array', items: { type: 'object' } },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error, or business rule violation (missing name / no contact method)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'No studio found for this user' })
  async patchMyProfile(@Req() req: JwtRequest, @Body() dto: UpdateStudioProfileDto) {
    const rawToken = req.headers['authorization']!.slice(7);
    return this.profileService.patchMyProfile(req.userId, rawToken, dto);
  }
}
