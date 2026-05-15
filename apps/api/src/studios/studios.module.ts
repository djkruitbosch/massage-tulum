import { Module } from '@nestjs/common';
import { StudiosController } from './studios.controller';
import { StudiosService } from './studios.service';
import { StudiosProfileController } from './studios-profile.controller';
import { StudiosProfileService } from './studios-profile.service';
import { AdminGuard } from './guards/admin.guard';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { BrevoService } from '../common/brevo/brevo.service';
import { supabaseProvider } from '../common/supabase/supabase.provider';
import { StudioResolverModule } from '../common/services/studio-resolver.module';

/**
 * StudiosModule — self-signup, admin approval/rejection, and studio management.
 *
 * Endpoints:
 *   POST  /api/studios/signup                    — public, throttled
 *   GET   /api/studios/me                        — studio owner, JWT-authenticated
 *   PATCH /api/studios/me                        — studio owner, JWT-authenticated
 *   GET   /api/admin/pending-studios             — admin only
 *   POST  /api/admin/pending-studios/:id/approve — admin only
 *   POST  /api/admin/pending-studios/:id/reject  — admin only
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 *      docs/architecture/CU-869d29f1h-studio-profile.md §3
 *      docs/adr/0008-studio-onboarding-self-signup.md
 */
@Module({
  imports: [StudioResolverModule],
  controllers: [StudiosController, StudiosProfileController],
  providers: [
    StudiosService,
    StudiosProfileService,
    AdminGuard,
    SupabaseJwtGuard,
    BrevoService,
    supabaseProvider,
  ],
})
export class StudiosModule {}
