import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for POST /api/admin/pending-studios/:id/reject.
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 */
export class RejectStudioDto {
  @ApiPropertyOptional({
    description: 'Optional reason for rejection (stored internally; not sent to applicant in v1)',
    example: 'Outside our current service area.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
