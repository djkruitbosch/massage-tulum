import { describe, expect, it } from 'vitest';
import {
  createTherapistSchema,
  setTherapistStatusSchema,
  therapistSchema,
  updateTherapistSchema,
} from './therapist.schema.js';

const validTherapist = {
  id: '00000000-0000-4000-8000-000000000001',
  studioId: '00000000-0000-4000-8000-000000000002',
  name: 'María García',
  role: 'Massage Therapist',
  phone: '+529841234567',
  email: 'maria@example.com',
  notes: 'Specializes in deep tissue.',
  photoUrl: 'https://supabase.example/storage/v1/object/sign/therapists/abc.jpg?token=xyz',
  status: 'active' as const,
  createdAt: '2026-05-17T10:00:00.000Z',
  updatedAt: '2026-05-17T10:00:00.000Z',
};

describe('therapistSchema', () => {
  it('accepts a full valid therapist row', () => {
    expect(() => therapistSchema.parse(validTherapist)).not.toThrow();
  });

  it('accepts null phone, email, notes, photoUrl', () => {
    expect(() =>
      therapistSchema.parse({
        ...validTherapist,
        phone: null,
        email: null,
        notes: null,
        photoUrl: null,
      }),
    ).not.toThrow();
  });

  it('rejects a non-UUID id', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, id: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID studioId', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, studioId: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 120 characters', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, name: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects an empty role', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, role: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a role longer than 80 characters', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, role: 'x'.repeat(81) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 500 characters', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, notes: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO createdAt', () => {
    const result = therapistSchema.safeParse({ ...validTherapist, createdAt: '2026-05-17' });
    expect(result.success).toBe(false);
  });
});

describe('createTherapistSchema', () => {
  const minimalValid = {
    name: 'Ana López',
    role: 'Massage Therapist',
  };

  it('accepts a minimal valid payload', () => {
    expect(() => createTherapistSchema.parse(minimalValid)).not.toThrow();
  });

  it('accepts optional phone, email, notes', () => {
    expect(() =>
      createTherapistSchema.parse({
        ...minimalValid,
        phone: '+52 984 123 4567',
        email: 'ana@example.com',
        notes: 'New hire',
      }),
    ).not.toThrow();
  });

  it('normalizes phone to E.164 via optionalPhoneSchema', () => {
    const result = createTherapistSchema.parse({
      ...minimalValid,
      phone: '+52 984 123 4567',
    });
    expect(result.phone).toBe('+529841234567');
  });

  it('accepts null phone, email, notes explicitly', () => {
    expect(() =>
      createTherapistSchema.parse({ ...minimalValid, phone: null, email: null, notes: null }),
    ).not.toThrow();
  });

  it('rejects an empty name with the localized message', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Name is required')).toBe(true);
    }
  });

  it('rejects an empty role with the localized message', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, role: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Role is required')).toBe(true);
    }
  });

  it('rejects a name longer than 120 characters', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, name: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects a role longer than 80 characters', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, role: 'x'.repeat(81) });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 500 characters', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, notes: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    const local = 'a'.repeat(250);
    const result = createTherapistSchema.safeParse({
      ...minimalValid,
      email: `${local}@x.io`,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format with the localized message', () => {
    const result = createTherapistSchema.safeParse({ ...minimalValid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'Invalid email format')).toBe(true);
    }
  });
});

describe('updateTherapistSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(() => updateTherapistSchema.parse({})).not.toThrow();
  });

  it('accepts a single-field partial update', () => {
    expect(() => updateTherapistSchema.parse({ name: 'Renamed' })).not.toThrow();
  });

  it('still enforces field-level constraints on provided fields', () => {
    const result = updateTherapistSchema.safeParse({ role: '' });
    expect(result.success).toBe(false);
  });
});

describe('setTherapistStatusSchema', () => {
  it('accepts status="active"', () => {
    expect(() => setTherapistStatusSchema.parse({ status: 'active' })).not.toThrow();
  });

  it('accepts status="inactive"', () => {
    expect(() => setTherapistStatusSchema.parse({ status: 'inactive' })).not.toThrow();
  });

  it('rejects any other status value', () => {
    const result = setTherapistStatusSchema.safeParse({ status: 'archived' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing status', () => {
    const result = setTherapistStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
