import { z } from 'zod';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Zod schema for phone number validation and normalization.
 *
 * Validates using libphonenumber-js and normalizes to E.164 format.
 * Default region is MX (Mexico) — allows bare local numbers to be resolved.
 *
 * Examples of accepted input:
 *   "+52 984 123 4567"  → "+529841234567"
 *   "984 123 4567"      → "+529841234567" (MX default region)
 *   "+1 212 555 0100"   → "+12125550100"
 *
 * See: docs/adr/0011-phone-number-storage-format.md
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .transform((val, ctx) => {
    try {
      if (!isValidPhoneNumber(val, 'MX')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid phone number',
        });
        return z.NEVER;
      }
      const parsed = parsePhoneNumber(val, 'MX');
      return parsed.format('E.164');
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number',
      });
      return z.NEVER;
    }
  });

/**
 * Zod schema for an optional phone number field.
 *
 * Accepts null, undefined, or a valid phone string.
 * When a non-null string is provided, it is normalized to E.164.
 */
export const optionalPhoneSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (val == null || val === '') return null;
    try {
      if (!isValidPhoneNumber(val, 'MX')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid phone number',
        });
        return z.NEVER;
      }
      const parsed = parsePhoneNumber(val, 'MX');
      return parsed.format('E.164');
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone number',
      });
      return z.NEVER;
    }
  });

export type PhoneE164 = string;
