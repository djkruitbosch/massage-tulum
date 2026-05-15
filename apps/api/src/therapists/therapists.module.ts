import { Module } from '@nestjs/common';
import { TherapistsController } from './therapists.controller';
import { TherapistsService } from './therapists.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { supabaseProvider } from '../common/supabase/supabase.provider';
import { StudioResolverModule } from '../common/services/studio-resolver.module';

/**
 * TherapistsModule — CRUD + status + photo upload for the therapist roster.
 *
 * Endpoints:
 *   GET    /api/studios/therapists                — list (filter by status)
 *   POST   /api/studios/therapists                — create
 *   PATCH  /api/studios/therapists/:id            — update fields
 *   PATCH  /api/studios/therapists/:id/status     — deactivate / reactivate
 *   POST   /api/studios/therapists/:id/photo      — upload/replace photo
 *   DELETE /api/studios/therapists/:id/photo      — remove photo
 *
 * All endpoints require SupabaseJwtGuard. studio_id is resolved from the
 * JWT — never accepted from the request body (via StudioResolverService).
 *
 * Photo upload uses Sharp (image processing) + Supabase Storage with the
 * user-scoped client (RLS enforced). File never touches disk (Multer memory).
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4
 *      docs/adr/0013-studio-scoped-resource-pattern.md
 */
@Module({
  imports: [StudioResolverModule],
  controllers: [TherapistsController],
  providers: [TherapistsService, SupabaseJwtGuard, supabaseProvider],
})
export class TherapistsModule {}
