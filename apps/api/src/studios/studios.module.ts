import { Module } from '@nestjs/common';
import { StudiosController } from './studios.controller';
import { StudiosService } from './studios.service';
import { AdminGuard } from './guards/admin.guard';
import { BrevoService } from '../common/brevo/brevo.service';
import { supabaseProvider } from '../common/supabase/supabase.provider';

/**
 * StudiosModule — self-signup, admin approval/rejection, and studio management.
 *
 * Endpoints:
 *   POST /api/studios/signup                    — public, throttled
 *   GET  /api/admin/pending-studios             — admin only
 *   POST /api/admin/pending-studios/:id/approve — admin only
 *   POST /api/admin/pending-studios/:id/reject  — admin only
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 *      docs/adr/0008-studio-onboarding-self-signup.md
 */
@Module({
  controllers: [StudiosController],
  providers: [StudiosService, AdminGuard, BrevoService, supabaseProvider],
})
export class StudiosModule {}
