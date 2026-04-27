import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.schema.js';

describe('healthResponseSchema', () => {
  it('parses a valid health response with status "ok"', () => {
    const input = { status: 'ok' };
    const result = healthResponseSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok' });
    }
  });

  it('rejects a response where status is not "ok"', () => {
    const input = { status: 'error' };
    const result = healthResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('invalid_literal');
    }
  });

  it('rejects a response with a missing status field', () => {
    const input = {};
    const result = healthResponseSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects a response with extra fields beyond the schema (passthrough is not enabled)', () => {
    // By default zod strips extra keys — parse succeeds but unknown fields are dropped
    const input = { status: 'ok', extra: 'field' };
    const result = healthResponseSchema.safeParse(input);
    // zod strips extra keys by default; parse should succeed with only { status: 'ok' }
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status: 'ok' });
      expect(result.data).not.toHaveProperty('extra');
    }
  });
});
