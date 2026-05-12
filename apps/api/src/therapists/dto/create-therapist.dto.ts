import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for POST /api/studios/therapists.
 *
 * studio_id is resolved server-side from the JWT — not accepted in the request body.
 * Phone is re-validated via E.164 regex; authoritative normalization happens in the
 * service layer via optionalPhoneSchema from packages/shared.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4d
 */
export class CreateTherapistDto {
  @ApiProperty({
    description: 'Therapist full name (1–120 chars)',
    example: 'Ana Martinez',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Therapist role or specialty (1–80 chars)',
    example: 'Masajista Certificada',
    minLength: 1,
    maxLength: 80,
  })
  @IsString()
  @IsNotEmpty({ message: 'Role is required' })
  @MinLength(1)
  @MaxLength(80)
  role!: string;

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
