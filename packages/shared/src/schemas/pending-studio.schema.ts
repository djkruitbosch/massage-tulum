import { z } from 'zod';

/**
 * Schema for POST /api/studios/signup request body.
 *
 * Shared between:
 * - apps/api: NestJS DTO validation (class-validator mirrors this schema)
 * - apps/web: react-hook-form + zod resolver on the signup form
 *
 * Field limits:
 *   email        — RFC 5321 maximum 254 chars
 *   studioName   — 1–100 chars
 *   contactPhone — optional, max 20 chars
 *   description  — 1–1000 chars
 *   locale       — 'es' | 'en' (matches pending_studios.locale CHECK constraint)
 *
 * See: docs/architecture/CU-869d29f1f-studio-owner-auth.md §3
 *      docs/adr/0008-studio-onboarding-self-signup.md
 */
export const createPendingStudioSchema = z.object({
  email: z.string().email().max(254),
  studioName: z.string().min(1).max(100),
  contactPhone: z.string().max(20).nullable().optional(),
  description: z.string().min(1).max(1000),
  locale: z.enum(['es', 'en']),
});

export type CreatePendingStudioInput = z.infer<typeof createPendingStudioSchema>;

/**
 * Schema for POST /api/studios/signup response body.
 */
export const signupResponseSchema = z.object({
  status: z.literal('pending'),
});

export type SignupResponse = z.infer<typeof signupResponseSchema>;

/**
 * Schema for a pending studio row as returned by the admin list endpoint.
 */
export const pendingStudioSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  studioName: z.string(),
  contactPhone: z.string().nullable(),
  description: z.string(),
  locale: z.enum(['es', 'en']),
  status: z.enum(['pending', 'approved', 'rejected']),
  submittedAt: z.string().datetime(),
});

export type PendingStudio = z.infer<typeof pendingStudioSchema>;

/**
 * Schema for GET /api/admin/pending-studios response body.
 */
export const pendingStudiosListSchema = z.object({
  data: z.array(pendingStudioSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

export type PendingStudiosList = z.infer<typeof pendingStudiosListSchema>;

/**
 * Schema for POST /api/admin/pending-studios/:id/reject request body.
 */
export const rejectStudioSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});

export type RejectStudioInput = z.infer<typeof rejectStudioSchema>;
