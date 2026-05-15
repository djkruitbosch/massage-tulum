import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';

/**
 * StudioResolverService — shared provider for resolving studio_id from a userId.
 *
 * Extracted from TherapistsService and StudiosProfileService when this became
 * the third NestJS domain requiring resolveStudioId (per ADR-0011 §"Consequences").
 *
 * Uses the service-role Supabase client so the studio_profiles lookup bypasses
 * RLS — required because we need the studio_id before we can construct
 * user-scoped queries for downstream operations.
 *
 * PII policy: userId is a UUID sub-claim, not sensitive. Logged for correlation.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §2.F
 *      docs/adr/0011-studio-scoped-resource-pattern.md §"NestJS service pattern"
 */
@Injectable()
export class StudioResolverService {
  private readonly logger = new Logger(StudioResolverService.name);

  constructor(
    // Service-role client: used ONLY for the studio_profiles lookup.
    @Inject(SUPABASE_CLIENT) private readonly adminSupabase: SupabaseClient,
  ) {}

  /**
   * Resolves the studio_id for a given auth user via studio_profiles lookup.
   *
   * @param userId  auth.uid() from the verified JWT sub claim
   * @returns       studio_id UUID string
   * @throws        NotFoundException('Studio not found for this user') if no profile row found
   */
  async resolveStudioId(userId: string): Promise<string> {
    const { data, error } = await this.adminSupabase
      .from('studio_profiles')
      .select('studio_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.logger.warn(`No studio_profile found for userId=${userId}`);
      throw new NotFoundException('Studio not found for this user');
    }

    return (data as { studio_id: string }).studio_id;
  }
}
