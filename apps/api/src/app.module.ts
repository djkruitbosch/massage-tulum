import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

/**
 * AppModule — root module.
 *
 * Keep this thin. Domain modules are imported here as they are added per
 * feature sprint (studios, therapists, bookings, auth, ...).
 * Do not add business logic or providers directly to this module.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
