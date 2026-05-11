import { z } from 'zod';
import { optionalPhoneSchema } from './phone.schema.js';

/**
 * Zod schema for a weekday entry in studio hours.
 *
 * weekday: 1 (Monday) – 7 (Sunday) per ISO 8601.
 * isOpen: whether the studio is open that day.
 * openTime / closeTime: HH:MM format. Required when isOpen = true.
 *
 * See: docs/adr/0012-business-hours-time-storage.md
 */
export const studioHoursEntrySchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    isOpen: z.boolean(),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format')
      .nullable()
      .optional(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:MM format')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.isOpen) return true;
      return data.openTime != null && data.closeTime != null;
    },
    { message: 'openTime and closeTime are required when isOpen is true' },
  )
  .refine(
    (data) => {
      if (!data.isOpen || !data.openTime || !data.closeTime) return true;
      return data.closeTime > data.openTime;
    },
    { message: 'closeTime must be after openTime' },
  );

export type StudioHoursEntry = z.infer<typeof studioHoursEntrySchema>;

/**
 * Array of 7 studio hours entries (one per weekday).
 */
export const studioHoursSchema = z.array(studioHoursEntrySchema).length(7);

export type StudioHours = z.infer<typeof studioHoursSchema>;

/**
 * Schema for the GET /api/studios/me response.
 *
 * Represents the full studio profile as returned by the API.
 * Shared between:
 *   - apps/api: NestJS service return type
 *   - apps/web: react-hook-form data + display
 *
 * See: docs/architecture/CU-869d29f1h-studio-profile.md §3
 */
export const studioProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  address: z.string().max(300).nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  hours: z.array(studioHoursEntrySchema),
  updatedAt: z.string().datetime(),
});

export type StudioProfile = z.infer<typeof studioProfileSchema>;

/**
 * Schema for PATCH /api/studios/me request body.
 *
 * All fields are optional — partial update (last-write-wins).
 * At least one contact method (phone or email) must be present
 * if the caller is setting them (validation is on the server side
 * after merge with existing data).
 *
 * See: docs/architecture/CU-869d29f1h-studio-profile.md §4
 */
export const updateStudioProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(300).nullable().optional(),
  phone: optionalPhoneSchema,
  email: z.string().email().max(254).nullable().optional(),
  hours: z.array(studioHoursEntrySchema).length(7).optional(),
});

export type UpdateStudioProfileInput = z.infer<typeof updateStudioProfileSchema>;
