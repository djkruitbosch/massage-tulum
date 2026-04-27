import { z } from 'zod';

/**
 * Schema for the GET /api/health response.
 *
 * Used by:
 * - apps/api: NestJS health controller response shape
 * - apps/web: any FE code that reads the health endpoint
 *
 * @see docs/architecture/repo-layout.md — "API health endpoint" section
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
