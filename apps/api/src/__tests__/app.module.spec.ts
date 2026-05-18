import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import 'reflect-metadata';
import { AppModule, THROTTLER_DEFAULTS } from '../app.module';

interface ProviderEntry {
  provide?: unknown;
  useClass?: unknown;
}

describe('AppModule', () => {
  it('registers ThrottlerGuard as APP_GUARD so @Throttle() is enforced', () => {
    // Without this APP_GUARD wiring, the @Throttle() decorators on
    // POST /api/studios/signup (3 req / 60 s / IP per ADR-0008 §1) are
    // metadata that nothing reads.
    const providers = Reflect.getMetadata('providers', AppModule) as ProviderEntry[] | undefined;

    expect(providers).toBeDefined();
    const guard = providers?.find((p) => p.provide === APP_GUARD);

    expect(guard).toBeDefined();
    expect(guard?.useClass).toBe(ThrottlerGuard);
  });

  it('sets a generous default throttler budget (≥60 req/min) so authenticated traffic is not starved', () => {
    // Regression guard: the default applies to every endpoint that does NOT
    // opt into a tighter @Throttle() override. Because all studio-owner traffic
    // egresses from Vercel's serverless IP pool, a tight default rate-limits
    // legitimate authenticated requests across the entire app — the exact
    // production symptom that triggered this PR. Tighter per-endpoint limits
    // (e.g. signup at 3/min) remain in place via @Throttle() decorators.
    expect(THROTTLER_DEFAULTS).toHaveLength(1);
    expect(THROTTLER_DEFAULTS[0].ttl).toBe(60000);
    expect(THROTTLER_DEFAULTS[0].limit).toBeGreaterThanOrEqual(60);
  });
});
