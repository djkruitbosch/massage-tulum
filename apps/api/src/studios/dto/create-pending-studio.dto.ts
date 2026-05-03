import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for POST /api/studios/signup.
 *
 * Mirrors the shared zod schema in packages/shared/src/schemas/pending-studio.schema.ts.
 * Frontend uses the zod schema directly; backend uses this class-validator DTO.
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 */
export class CreatePendingStudioDto {
  @ApiProperty({
    description: 'Studio owner email address (becomes the login email)',
    example: 'owner@mystudio.com',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    description: 'Studio display name',
    example: 'Tulum Wellness Studio',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  studioName!: string;

  @ApiPropertyOptional({
    description: 'Contact phone number (optional)',
    example: '+52 984 123 4567',
    maxLength: 20,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string | null;

  @ApiProperty({
    description: 'Short description of the studio',
    example: 'We offer traditional Mayan massage techniques in the heart of Tulum.',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;

  @ApiProperty({
    description: 'UI locale at the time of signup (used for bilingual welcome email)',
    enum: ['es', 'en'],
    example: 'es',
  })
  @IsEnum(['es', 'en'])
  locale!: 'es' | 'en';
}
