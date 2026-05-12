import { ApiProperty } from '@nestjs/swagger';
import { TherapistResponseDto } from './therapist-response.dto';

/**
 * Response DTO for POST /api/studios/therapists/:id/photo.
 *
 * Returns the full updated therapist response after the photo has been
 * processed, uploaded, and the row updated. photoUrl is always a signed URL
 * (never null) on a successful upload response.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4g, §12d
 */
export class UploadPhotoResponseDto extends TherapistResponseDto {
  @ApiProperty({
    description: 'Signed URL (1-hour TTL) for the newly uploaded photo',
    example:
      'https://project.supabase.co/storage/v1/object/sign/therapist-photos/therapists/uuid/uuid.webp?token=...',
  })
  declare photoUrl: string;
}
