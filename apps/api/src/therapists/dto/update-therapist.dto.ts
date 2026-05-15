import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for PATCH /api/studios/therapists/:id.
 *
 * All fields are optional — partial update.
 * At least one field must be provided (enforced in the service layer).
 * Cannot update `status` here — use PATCH /api/studios/therapists/:id/status.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4e
 */
export class UpdateTherapistDto {
  @ApiPropertyOptional({
    description: 'Therapist full name (1–120 chars)',
    example: 'Ana Martinez',
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Therapist role or specialty (1–80 chars)',
    example: 'Masajista Certificada',
    minLength: 1,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  role?: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format (e.g. +529840000001)',
    example: '+529840000001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid E.164 number (e.g. +529840000001)',
  })
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'ana@studio.com',
    nullable: true,
    maxLength: 254,
  })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Internal notes visible to studio staff only (max 500 chars)',
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
