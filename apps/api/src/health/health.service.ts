import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@massage-tulum/shared';

/**
 * HealthService
 *
 * Provides the liveness status of the API process.
 * This is intentionally minimal — it is a liveness probe only, not a readiness
 * check. A readiness check (e.g. Supabase connectivity) is a future concern.
 */
@Injectable()
export class HealthService {
  /**
   * Returns the current health status.
   *
   * The return type is HealthResponse (from @massage-tulum/shared), which is
   * inferred from healthResponseSchema. The controller validates it at the
   * type level; no runtime validation is needed here because the literal is
   * hard-coded.
   */
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
