import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudioHoursEntryDto } from './studio-hours-entry.dto';

/**
 * DTO for PATCH /api/studios/profile.
 *
 * All fields are optional — any combination may be provided.
 * Business rule: after merge, the studio must have name + at least one
 * of (phone, email). Enforced by the service layer, not this DTO.
 *
 * phone: E.164 format validated by NestJS regex and libphonenumber-js on
 *        the shared schema. FE normalizes before sending; server re-validates.
 *
 * hours: full 7-element array when provided (all weekdays at once, atomic).
 *
 * See: docs/architecture/CU-869d29f1h-studio-profile.md §4
 */
export class UpdateStudioProfileDto {
  @ApiPropertyOptional({
    description: 'Studio display name (1–100 chars)',
    example: 'Tulum Wellness Studio',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Studio physical address (max 300 chars)',
    example: 'Av. Tulum, Centro, Tulum, Quintana Roo, Mexico',
    maxLength: 300,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Studio phone number in E.164 format (doubles as WhatsApp)',
    example: '+529841234567',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid E.164 number (e.g. +529841234567)',
  })
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Studio contact email (max 254 chars)',
    example: 'hello@myStudio.com',
    maxLength: 254,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Free-text description of the studio (max 500 chars)',
    example: 'Holistic massage therapy in the heart of Tulum.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'Business hours — array of exactly 7 entries, one per weekday (1=Mon … 7=Sun). ' +
      'When provided, all 7 weekdays must be included (full replacement, not partial).',
    type: [StudioHoursEntryDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => StudioHoursEntryDto)
  hours?: StudioHoursEntryDto[];
}
