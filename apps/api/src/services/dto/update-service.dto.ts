import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for PATCH /api/studios/services/:id.
 *
 * All fields are optional — this is a partial update.
 * The service method enforces that at least one field is provided
 * (throws BadRequestException if all fields are undefined).
 *
 * Validation errors return 422 Unprocessable Entity.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4c
 */
export class UpdateServiceDto {
  @ApiPropertyOptional({
    description: 'Service name (1–120 chars, trimmed before save)',
    example: 'Deep Tissue Massage',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty if provided' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Service description (max 1000 chars). Null/empty → stored as null.',
    example: 'A deep tissue massage targeting chronic muscle tension.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Category label (max 60 chars, stored verbatim). Null/empty → stored as null.',
    example: 'Relajación',
    maxLength: 60,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional({
    description: 'Duration in minutes (positive integer, min 1)',
    example: 60,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'durationMinutes must be an integer' })
  @Min(1, { message: 'durationMinutes must be at least 1' })
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Base price in whole MXN pesos (integer, min 0). 0 = free service.',
    example: 1200,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'basePriceMxn must be an integer' })
  @Min(0, { message: 'basePriceMxn must be 0 or greater' })
  basePriceMxn?: number;
}
