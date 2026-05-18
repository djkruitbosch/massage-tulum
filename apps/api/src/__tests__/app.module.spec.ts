import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { readFileSync } from 'fs';
import { join } from 'path';
import 'reflect-metadata';
import { AppModule } from '../app.module';

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
    //
    // Reflect.getMetadata can't reach into the DynamicModule that
    // ThrottlerModule.forRoot returns, so we assert directly against the
    // source — the only place the value is set.
    const src = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf-8');
    const match = src.match(/ThrottlerModule\.forRoot\(\s*\[\s*{[\s\S]*?limit:\s*(\d+)/);
    expect(match).toBeTruthy();
    const limit = Number(match![1]);
    expect(limit).toBeGreaterThanOrEqual(60);
  });
});
