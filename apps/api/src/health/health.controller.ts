import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponse } from '@massage-tulum/shared';
import { HealthService } from './health.service';

/**
 * HealthController
 *
 * Exposes GET /api/health — the liveness probe used by Uptime Kuma and the
 * Coolify health check (ADR-0001).
 *
 * PUBLIC ENDPOINT — no auth required.
 * Per CLAUDE.md convention: public endpoints require an explicit marker and
 * reviewer approval. This endpoint is approved: a liveness probe with no data
 * access requires no authentication.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /api/health
   *
   * Liveness probe. Returns { status: 'ok' } while the process is running.
   * HTTP 200.
   */
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns { status: "ok" } while the API process is running. ' +
      'Used by Uptime Kuma (ADR-0001) and container health checks.',
  })
  @ApiOkResponse({
    description: 'Service is up',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
      example: { status: 'ok' },
    },
  })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
