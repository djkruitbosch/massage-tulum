/**
 * @massage-tulum/shared
 *
 * Shared TypeScript types and Zod validation schemas.
 * Consumed by both apps/api (NestJS) and apps/web (Next.js).
 *
 * Do not import from apps/* here — this package must remain framework-agnostic.
 */
export * from './schemas/index.js';
export * from './utils/time.js';
