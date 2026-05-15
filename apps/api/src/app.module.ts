import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { StudiosModule } from './studios/studios.module';
import { TherapistsModule } from './therapists/therapists.module';

/**
 * AppModule — root module.
 *
 * Keep this thin. Domain modules are imported here as they are added per
 * feature sprint (studios, therapists, bookings, auth, ...).
 * Do not add business logic or providers directly to this module.
 *
 * ThrottlerModule: global rate limiter used by @Throttle() on public endpoints.
 * Default: 3 requests / 60 seconds / IP (applies where @Throttle is applied).
 * See: docs/adr/0008-studio-onboarding-self-signup.md §1
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Default throttler config — overridden per-endpoint with @Throttle().
        ttl: 60000,
        limit: 10,
      },
    ]),
    HealthModule,
    StudiosModule,
    TherapistsModule,
  ],
})
export class AppModule {}
