import { HealthService } from '../health.service';
import { healthResponseSchema } from '@massage-tulum/shared';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  it('returns status ok', () => {
    const result = service.getHealth();
    expect(result).toEqual({ status: 'ok' });
  });

  it('return value passes healthResponseSchema validation', () => {
    const result = service.getHealth();
    // Parse will throw if the shape does not match the shared schema.
    // This test is the contract: the shared Zod schema and the NestJS service
    // must agree on the response shape.
    expect(() => healthResponseSchema.parse(result)).not.toThrow();
  });

  it('return value has status literal "ok" (not any other string)', () => {
    const result = service.getHealth();
    // z.literal('ok') means only 'ok' is valid — verify that explicitly.
    const parsed = healthResponseSchema.parse(result);
    expect(parsed.status).toBe('ok');
  });
});
