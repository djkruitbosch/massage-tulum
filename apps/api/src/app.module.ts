import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { StudiosModule } from './studios/studios.module';
import { TherapistsModule } from './therapists/therapists.module';
import { ServicesModule } from './services/services.module';

/**
 * AppModule — root module.
 *
 * Keep this thin. Domain modules are imported here as they are added per
 * feature sprint (studios, therapists, bookings, auth, ...).
 * Do not add business logic or providers directly to this module.
 *
 * ThrottlerModule + ThrottlerGuard: rate limiter wired up globally so that
 * the @Throttle() decorator on public endpoints (e.g. POST /api/studios/signup,
 * 3 req / 60 s / IP per ADR-0008 §1) is actually enforced. Without registering
 * ThrottlerGuard via APP_GUARD, the decorator is just metadata that nothing
 * reads.
 *
 * Default budget is intentionally generous (100 req / 60 s / IP). Because the
 * API sits behind the Vercel frontend, every studio owner's traffic egresses
 * from Vercel's serverless function IP pool — meaning many users (and many
 * server-action calls per page load) share the same throttler bucket. A tight
 * default starves normal authenticated traffic. Endpoints that need stricter
 * limits (signup, password reset, etc.) opt in with @Throttle() per ADR-0008.
 *
 * See: docs/adr/0008-studio-onboarding-self-signup.md §1
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Generous default; tight per-endpoint limits via @Throttle().
        ttl: 60000,
        limit: 100,
      },
    ]),
    HealthModule,
    StudiosModule,
    TherapistsModule,
    ServicesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
