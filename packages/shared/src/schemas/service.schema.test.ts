import { describe, expect, it } from 'vitest';
import {
  createServiceSchema,
  futureBookingsCountSchema,
  serviceResponseSchema,
  updateServiceSchema,
} from './service.schema.js';

const validResponse = {
  id: '00000000-0000-4000-8000-000000000001',
  studioId: '00000000-0000-4000-8000-000000000002',
  name: 'Deep Tissue Massage',
  description: '60-minute deep-tissue session',
  category: 'Massage',
  durationMinutes: 60,
  basePriceMxn: 1500,
  status: 'active' as const,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
};

describe('serviceResponseSchema', () => {
  it('accepts a full valid service row', () => {
    expect(() => serviceResponseSchema.parse(validResponse)).not.toThrow();
  });

  it('accepts null description and category', () => {
    expect(() =>
      serviceResponseSchema.parse({ ...validResponse, description: null, category: null }),
    ).not.toThrow();
  });

  it('rejects a non-UUID id', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 120 characters', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, name: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects a description longer than 1000 characters', () => {
    const result = serviceResponseSchema.safeParse({
      ...validResponse,
      description: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects durationMinutes below 1', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer durationMinutes', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, durationMinutes: 60.5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative basePriceMxn', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, basePriceMxn: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer basePriceMxn', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, basePriceMxn: 1500.5 });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, status: 'archived' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO createdAt', () => {
    const result = serviceResponseSchema.safeParse({ ...validResponse, createdAt: 'yesterday' });
    expect(result.success).toBe(false);
  });
});

describe('createServiceSchema', () => {
  const minimalValid = {
    name: 'Swedish Massage',
    durationMinutes: 60,
    basePriceMxn: 1200,
  };

  it('accepts a minimal valid payload', () => {
    expect(() => createServiceSchema.parse(minimalValid)).not.toThrow();
  });

  it('accepts optional description and category', () => {
    expect(() =>
      createServiceSchema.parse({
        ...minimalValid,
        description: 'Relaxing full-body massage',
        category: 'Massage',
      }),
    ).not.toThrow();
  });

  it('accepts null description and null category', () => {
    expect(() =>
      createServiceSchema.parse({ ...minimalValid, description: null, category: null }),
    ).not.toThrow();
  });

  it('rejects an empty name with the localized message', () => {
    const result = createServiceSchema.safeParse({ ...minimalValid, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Name is required');
    }
  });

  it('rejects a description longer than 1000 characters', () => {
    const result = createServiceSchema.safeParse({
      ...minimalValid,
      description: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a category longer than 60 characters', () => {
    const result = createServiceSchema.safeParse({
      ...minimalValid,
      category: 'x'.repeat(61),
    });
    expect(result.success).toBe(false);
  });

  it('rejects durationMinutes below 1', () => {
    const result = createServiceSchema.safeParse({ ...minimalValid, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer durationMinutes', () => {
    const result = createServiceSchema.safeParse({ ...minimalValid, durationMinutes: 45.5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative basePriceMxn', () => {
    const result = createServiceSchema.safeParse({ ...minimalValid, basePriceMxn: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts basePriceMxn of 0 (free service)', () => {
    expect(() => createServiceSchema.parse({ ...minimalValid, basePriceMxn: 0 })).not.toThrow();
  });

  it('rejects non-integer basePriceMxn', () => {
    const result = createServiceSchema.safeParse({ ...minimalValid, basePriceMxn: 1200.5 });
    expect(result.success).toBe(false);
  });
});

describe('updateServiceSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => updateServiceSchema.parse({})).not.toThrow();
  });

  it('accepts a single-field partial update', () => {
    expect(() => updateServiceSchema.parse({ name: 'Renamed Service' })).not.toThrow();
  });

  it('still enforces field-level constraints on provided fields', () => {
    const result = updateServiceSchema.safeParse({ durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized name even in partial update', () => {
    const result = updateServiceSchema.safeParse({ name: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });
});

describe('futureBookingsCountSchema', () => {
  it('accepts a zero count', () => {
    expect(() => futureBookingsCountSchema.parse({ futureBookingsCount: 0 })).not.toThrow();
  });

  it('accepts a positive count', () => {
    expect(() => futureBookingsCountSchema.parse({ futureBookingsCount: 12 })).not.toThrow();
  });

  it('rejects a negative count', () => {
    const result = futureBookingsCountSchema.safeParse({ futureBookingsCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer count', () => {
    const result = futureBookingsCountSchema.safeParse({ futureBookingsCount: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing field', () => {
    const result = futureBookingsCountSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
