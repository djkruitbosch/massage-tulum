import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Query DTO for GET /api/admin/pending-studios.
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 */
export class ListPendingStudiosDto {
  @ApiPropertyOptional({
    description: 'Filter by status. Defaults to "pending".',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected' = 'pending';

  @ApiPropertyOptional({
    description: 'Page number (1-based). Defaults to 1.',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page. Defaults to 20, max 100.',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
