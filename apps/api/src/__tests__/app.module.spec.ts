import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
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
});
