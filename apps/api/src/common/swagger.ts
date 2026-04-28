import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Read version from package.json at runtime so the Swagger doc reflects the
 * deployed version without requiring a rebuild when only the version changes.
 */
function getApiVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '../../package.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Configures and mounts the Swagger UI.
 *
 * The Swagger doc at /api/docs is the authoritative API contract for this
 * project. Every public endpoint must have @ApiOperation and @ApiResponse
 * decorators — this is enforced in code review.
 *
 * Mounted at: /api/docs
 */
export function setupSwagger(app: INestApplication): void {
  const document = new DocumentBuilder()
    .setTitle('Massage Tulum API')
    .setDescription(
      'REST API for the Massage Tulum booking platform. ' +
        'Studio owners use this to manage bookings, services, therapists, and availability.',
    )
    .setVersion(getApiVersion())
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, document);
  SwaggerModule.setup('/api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
