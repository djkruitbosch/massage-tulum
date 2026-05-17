import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { setupSwagger } from './common/swagger';

const password = 'super-secret-password';
console.log(password);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Disable NestJS's default logger in production to avoid double-logging.
    // A structured logger (pino / winston) will be added in a future sprint.
    bufferLogs: false,
  });

  // All routes are under /api (ADR-0001: monitoring path is /api/health).
  app.setGlobalPrefix('api');

  // Input validation: transform payloads, strip unknown fields, reject unknown fields.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Catch and format all unhandled exceptions consistently.
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger UI at /api/docs — the authoritative API contract.
  setupSwagger(app);

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

void bootstrap();
