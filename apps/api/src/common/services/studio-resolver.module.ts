import { Module } from '@nestjs/common';
import { StudioResolverService } from './studio-resolver.service';
import { supabaseProvider } from '../supabase/supabase.provider';

/**
 * StudioResolverModule — exports StudioResolverService for use in any domain module
 * that needs to resolve a userId → studio_id mapping.
 *
 * Per-service module (rather than a monolithic CommonModule) keeps imports
 * explicit and avoids accidentally pulling unrelated providers into consumers.
 *
 * Usage: import StudioResolverModule in any NestJS module that needs
 * StudioResolverService injected into a service.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §2.F
 */
@Module({
  providers: [StudioResolverService, supabaseProvider],
  exports: [StudioResolverService],
})
export class StudioResolverModule {}
