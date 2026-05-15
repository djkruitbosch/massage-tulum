import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO representing a service as returned by the API.
 *
 * All field names are camelCase (mapped from snake_case DB columns by the service).
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4b
 */
export class ServiceResponseDto {
  @ApiProperty({ description: 'Service UUID', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Studio UUID this service belongs to', format: 'uuid' })
  studioId!: string;

  @ApiProperty({ description: 'Service name (1–120 chars)', example: 'Deep Tissue Massage' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Service description (max 1000 chars). Null if not provided.',
    example: 'A deep tissue massage targeting chronic muscle tension.',
    nullable: true,
    maxLength: 1000,
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'Category label (max 60 chars, stored verbatim). Null if not assigned.',
    example: 'Relajación',
    nullable: true,
    maxLength: 60,
  })
  category!: string | null;

  @ApiProperty({ description: 'Duration in minutes (positive integer)', example: 60, minimum: 1 })
  durationMinutes!: number;

  @ApiProperty({
    description:
      'Base price in whole MXN pesos (integer). 0 = free service. ' +
      'Multiply by 100 for Stripe centavos in v2.',
    example: 1200,
    minimum: 0,
  })
  basePriceMxn!: number;

  @ApiProperty({
    description: 'Service status',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  status!: 'active' | 'inactive';

  @ApiProperty({ description: 'ISO 8601 creation timestamp', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ description: 'ISO 8601 last-updated timestamp', format: 'date-time' })
  updatedAt!: string;
}

/**
 * DTO for GET /api/studios/services/categories response.
 * Returned as a plain string[] — no wrapper DTO class needed, documented inline.
 */

/**
 * DTO for GET /api/studios/services/:id/future-bookings-count response.
 */
export class FutureBookingsCountDto {
  @ApiProperty({
    description:
      'Number of future confirmed/pending bookings for this service. ' +
      'Always 0 in v1 (bookings table not yet created).',
    example: 0,
    minimum: 0,
  })
  futureBookingsCount!: number;
}
