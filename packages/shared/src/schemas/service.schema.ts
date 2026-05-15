import { z } from 'zod';

/**
 * Zod schema for a full service row as returned by the API.
 *
 * Field constraints match the NestJS DTO validators exactly (§4c of the arch doc).
 * Used by the FE (react-hook-form + zod resolver) to parse/validate API responses.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4b, §4d
 */
export const serviceResponseSchema = z.object({
  id: z.string().uuid(),
  studioId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  category: z.string().max(60).nullable(),
  durationMinutes: z.number().int().min(1),
  basePriceMxn: z.number().int().min(0),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ServiceResponse = z.infer<typeof serviceResponseSchema>;

/**
 * Schema for POST /api/studios/services request body.
 *
 * studio_id is resolved server-side from the JWT — not accepted in the body.
 * Constraints mirror the CreateServiceDto class-validator decorators exactly.
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4c
 */
export const createServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or fewer')
    .nullable()
    .optional(),
  category: z.string().max(60, 'Category must be 60 characters or fewer').nullable().optional(),
  durationMinutes: z
    .number()
    .int('Duration must be an integer')
    .min(1, 'Duration must be at least 1 minute'),
  basePriceMxn: z.number().int('Price must be an integer').min(0, 'Price must be 0 or greater'),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Schema for PATCH /api/studios/services/:id request body.
 *
 * All fields are optional — partial update.
 * At least one field must be provided (enforced server-side, not in this schema).
 *
 * See: docs/architecture/CU-869d29f21-service-catalog.md §4c
 */
export const updateServiceSchema = createServiceSchema.partial();

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Schema for GET /api/studios/services/:id/future-bookings-count response.
 *
 * Always { futureBookingsCount: 0 } in v1 (bookings table not yet created).
 */
export const futureBookingsCountSchema = z.object({
  futureBookingsCount: z.number().int().min(0),
});

export type FutureBookingsCount = z.infer<typeof futureBookingsCountSchema>;
