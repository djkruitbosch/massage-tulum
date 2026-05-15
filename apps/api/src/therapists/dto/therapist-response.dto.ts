import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO representing a therapist as returned by the API.
 *
 * photoUrl is a Supabase Storage signed URL (1-hour TTL) generated server-side.
 * The raw Storage path is never exposed to clients.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4c
 */
export class TherapistResponseDto {
  @ApiProperty({ description: 'Therapist UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Studio UUID this therapist belongs to', format: 'uuid' })
  studioId!: string;

  @ApiProperty({ description: 'Therapist full name (1–120 chars)', example: 'Ana Martinez' })
  name!: string;

  @ApiProperty({
    description: 'Therapist role or specialty (1–80 chars)',
    example: 'Masajista Certificada',
  })
  role!: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format',
    example: '+529840000001',
    nullable: true,
  })
  phone!: string | null;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'ana@studio.com',
    nullable: true,
  })
  email!: string | null;

  @ApiPropertyOptional({
    description: 'Internal notes (max 500 chars). Visible to studio staff only.',
    nullable: true,
    maxLength: 500,
  })
  notes!: string | null;

  @ApiPropertyOptional({
    description:
      'Signed URL (1-hour TTL) for the therapist photo. Null if no photo has been uploaded. ' +
      'The raw Storage path is never returned to clients.',
    nullable: true,
  })
  photoUrl!: string | null;

  @ApiProperty({
    description: 'Therapist status',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  status!: 'active' | 'inactive';

  @ApiProperty({ description: 'ISO 8601 creation timestamp', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-updated timestamp', format: 'date-time' })
  updatedAt!: string;
}
