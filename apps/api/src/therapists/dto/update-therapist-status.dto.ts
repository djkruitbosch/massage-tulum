import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for PATCH /api/studios/therapists/:id/status.
 *
 * Accepts only 'active' or 'inactive'. Other status transitions are not
 * exposed via the API in v1 (ADR-0013 soft-delete pattern).
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4f
 */
export class UpdateTherapistStatusDto {
  @ApiProperty({
    description: "New status for the therapist. 'inactive' soft-deactivates; 'active' reactivates.",
    enum: ['active', 'inactive'],
    example: 'inactive',
  })
  @IsEnum(['active', 'inactive'], {
    message: "status must be 'active' or 'inactive'",
  })
  status!: 'active' | 'inactive';
}
