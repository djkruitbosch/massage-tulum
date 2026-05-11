import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cross-field constraint: closeTime must be strictly after openTime
 * when isOpen=true. HH:MM lexicographic comparison is equivalent to
 * time comparison for zero-padded 24h strings.
 */
@ValidatorConstraint({ name: 'IsCloseTimeAfterOpenTime', async: false })
class IsCloseTimeAfterOpenTimeConstraint implements ValidatorConstraintInterface {
  validate(closeTime: unknown, args: ValidationArguments): boolean {
    const entry = args.object as StudioHoursEntryDto;
    if (entry.isOpen !== true) return true; // not applicable when closed
    if (typeof closeTime !== 'string' || typeof entry.openTime !== 'string') {
      return true; // let format/required validators handle these cases
    }
    return closeTime > entry.openTime;
  }

  defaultMessage(): string {
    return 'closeTime must be strictly after openTime';
  }
}

/**
 * DTO for a single weekday entry in studio business hours.
 *
 * weekday: 1 (Monday) – 7 (Sunday) per ISO 8601.
 * isOpen: when false, openTime and closeTime must be absent.
 * openTime/closeTime: HH:MM format; required when isOpen=true.
 *
 * See: docs/adr/0012-business-hours-time-storage.md
 *      docs/architecture/CU-869d29f1h-studio-profile.md §4
 */
export class StudioHoursEntryDto {
  @ApiProperty({
    description: 'Weekday number: 1=Monday … 7=Sunday (ISO 8601)',
    minimum: 1,
    maximum: 7,
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({
    description: 'True if the studio is open on this day',
    example: true,
  })
  @IsBoolean()
  isOpen!: boolean;

  @ApiPropertyOptional({
    description: 'Opening time in HH:MM format (required when isOpen=true)',
    example: '09:00',
    nullable: true,
  })
  @ValidateIf((o: StudioHoursEntryDto) => o.isOpen === true)
  @IsNotEmpty({ message: 'openTime is required when isOpen is true' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'openTime must be HH:MM format' })
  @ValidateIf((o: StudioHoursEntryDto) => o.isOpen === false)
  @IsOptional()
  openTime?: string | null;

  @ApiPropertyOptional({
    description: 'Closing time in HH:MM format (required when isOpen=true, must be after openTime)',
    example: '21:00',
    nullable: true,
  })
  @ValidateIf((o: StudioHoursEntryDto) => o.isOpen === true)
  @IsNotEmpty({ message: 'closeTime is required when isOpen is true' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'closeTime must be HH:MM format' })
  @Validate(IsCloseTimeAfterOpenTimeConstraint)
  @ValidateIf((o: StudioHoursEntryDto) => o.isOpen === false)
  @IsOptional()
  closeTime?: string | null;
}
