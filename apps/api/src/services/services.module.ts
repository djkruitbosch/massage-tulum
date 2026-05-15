import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { supabaseProvider } from '../common/supabase/supabase.provider';
import { StudioResolverModule } from '../common/services/studio-resolver.module';

/**
 * ServicesModule — CRUD + status management for the service catalog.
 *
 * Endpoints:
 *   GET    /api/studios/services                              — list (filter by status, default 'active')
 *   GET    /api/studios/services/categories                   — distinct categories for the studio
 *   POST   /api/studios/services                              — create
 *   PATCH  /api/studios/services/:id                         — update fields
 *   GET    /api/studios/services/:id/future-bookings-count   — preflight for deactivation
 *   POST   /api/studios/services/:id/deactivate              — set status=inactive
 *   POST   /api/studios/services/:id/reactivate              — set status=active
 *
 * All endpoints require SupabaseJwtGuard. studio_id is resolved from the
 * JWT — never accepted from the request body (via StudioResolverService).
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4
 *      docs/adr/0011-studio-scoped-resource-pattern.md
 */
@Module({
  imports: [StudioResolverModule],
  controllers: [ServicesController],
  providers: [ServicesService, SupabaseJwtGuard, supabaseProvider],
})
export class ServicesModule {}
