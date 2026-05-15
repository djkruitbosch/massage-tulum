import { z } from 'zod';
import { optionalPhoneSchema } from './phone.schema.js';

/**
 * Zod schema for a full therapist row as returned by the API.
 *
 * photoUrl is a signed URL (1-hour TTL) generated server-side by NestJS.
 * The raw Storage path is never sent to the client.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4j
 *      docs/adr/0011-studio-scoped-resource-pattern.md
 */
export const therapistSchema = z.object({
  id: z.string().uuid(),
  studioId: z.string().uuid(),
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(80),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  notes: z.string().max(500).nullable(),
  /** Signed URL (1-hour TTL) or null when no photo has been uploaded. */
  photoUrl: z.string().nullable(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Therapist = z.infer<typeof therapistSchema>;

/**
 * Schema for POST /api/studios/therapists request body.
 *
 * studio_id is resolved server-side from the JWT — not accepted in the body.
 * phone is validated and normalized to E.164 by optionalPhoneSchema.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4d
 */
export const createTherapistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  role: z.string().min(1, 'Role is required').max(80),
  phone: optionalPhoneSchema,
  email: z.string().email('Invalid email format').max(254).nullable().optional(),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').nullable().optional(),
});

export type CreateTherapistInput = z.infer<typeof createTherapistSchema>;

/**
 * Schema for PATCH /api/studios/therapists/:id request body.
 *
 * All fields are optional — partial update.
 * At least one field must be provided (enforced server-side).
 * Cannot update status here — use the dedicated PATCH /status endpoint.
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4e
 */
export const updateTherapistSchema = createTherapistSchema.partial();

export type UpdateTherapistInput = z.infer<typeof updateTherapistSchema>;

/**
 * Schema for PATCH /api/studios/therapists/:id/status request body.
 *
 * Only accepts 'active' or 'inactive'. Other status transitions are
 * not exposed via the API in v1 (ADR-0011 soft-delete pattern).
 *
 * See: docs/architecture/CU-869d29f1p-therapist-roster.md §4f
 */
export const setTherapistStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export type SetTherapistStatusInput = z.infer<typeof setTherapistStatusSchema>;
