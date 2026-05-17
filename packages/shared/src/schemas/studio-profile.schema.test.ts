import { describe, expect, it } from 'vitest';
import {
  studioHoursEntrySchema,
  studioHoursSchema,
  studioProfileSchema,
  updateStudioProfileSchema,
} from './studio-profile.schema.js';

const openEntry = {
  weekday: 1,
  isOpen: true,
  openTime: '09:00',
  closeTime: '18:00',
};

const closedEntry = {
  weekday: 2,
  isOpen: false,
};

describe('studioHoursEntrySchema', () => {
  it('accepts an open day with valid HH:MM times', () => {
    expect(() => studioHoursEntrySchema.parse(openEntry)).not.toThrow();
  });

  it('accepts a closed day without times', () => {
    expect(() => studioHoursEntrySchema.parse(closedEntry)).not.toThrow();
  });

  it('accepts a closed day with null times explicitly', () => {
    expect(() =>
      studioHoursEntrySchema.parse({ ...closedEntry, openTime: null, closeTime: null }),
    ).not.toThrow();
  });

  it('rejects weekday below 1', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, weekday: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects weekday above 7', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, weekday: 8 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer weekday', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, weekday: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects malformed openTime (no colon)', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, openTime: '0900' });
    expect(result.success).toBe(false);
  });

  it('rejects openTime with seconds', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, openTime: '09:00:00' });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range hour like 24:00', () => {
    const result = studioHoursEntrySchema.safeParse({ ...openEntry, openTime: '24:00' });
    expect(result.success).toBe(false);
  });

  it('requires openTime when isOpen is true', () => {
    const result = studioHoursEntrySchema.safeParse({
      weekday: 1,
      isOpen: true,
      closeTime: '18:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('required'))).toBe(true);
    }
  });

  it('requires closeTime when isOpen is true', () => {
    const result = studioHoursEntrySchema.safeParse({
      weekday: 1,
      isOpen: true,
      openTime: '09:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects closeTime equal to openTime', () => {
    const result = studioHoursEntrySchema.safeParse({
      ...openEntry,
      openTime: '09:00',
      closeTime: '09:00',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('after'))).toBe(true);
    }
  });

  it('rejects closeTime before openTime', () => {
    const result = studioHoursEntrySchema.safeParse({
      ...openEntry,
      openTime: '18:00',
      closeTime: '09:00',
    });
    expect(result.success).toBe(false);
  });
});

describe('studioHoursSchema', () => {
  const sevenDays = Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    isOpen: false,
  }));

  it('accepts exactly 7 entries', () => {
    expect(() => studioHoursSchema.parse(sevenDays)).not.toThrow();
  });

  it('rejects fewer than 7 entries', () => {
    const result = studioHoursSchema.safeParse(sevenDays.slice(0, 6));
    expect(result.success).toBe(false);
  });

  it('rejects more than 7 entries', () => {
    const result = studioHoursSchema.safeParse([...sevenDays, { weekday: 1, isOpen: false }]);
    expect(result.success).toBe(false);
  });
});

const validProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Tulum Healing Studio',
  address: 'Aldea Zama, Tulum, Q.R., México',
  phone: '+529841234567',
  email: 'owner@tulumhealing.com',
  description: 'Boutique massage studio in Aldea Zama.',
  hours: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, isOpen: false })),
  updatedAt: '2026-05-17T10:00:00.000Z',
};

describe('studioProfileSchema', () => {
  it('accepts a full valid profile', () => {
    expect(() => studioProfileSchema.parse(validProfile)).not.toThrow();
  });

  it('accepts null address, phone, email, description', () => {
    expect(() =>
      studioProfileSchema.parse({
        ...validProfile,
        address: null,
        phone: null,
        email: null,
        description: null,
      }),
    ).not.toThrow();
  });

  it('rejects an empty name', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 100 characters', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects an address longer than 300 characters', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, address: 'x'.repeat(301) });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a description longer than 500 characters', () => {
    const result = studioProfileSchema.safeParse({
      ...validProfile,
      description: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID id', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, id: 'studio-1' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO updatedAt', () => {
    const result = studioProfileSchema.safeParse({ ...validProfile, updatedAt: 'yesterday' });
    expect(result.success).toBe(false);
  });
});

describe('updateStudioProfileSchema', () => {
  it('accepts an empty object', () => {
    expect(() => updateStudioProfileSchema.parse({})).not.toThrow();
  });

  it('accepts a single field update', () => {
    expect(() => updateStudioProfileSchema.parse({ name: 'Renamed Studio' })).not.toThrow();
  });

  it('accepts setting nullable fields to null', () => {
    expect(() =>
      updateStudioProfileSchema.parse({
        address: null,
        phone: null,
        email: null,
        description: null,
      }),
    ).not.toThrow();
  });

  it('normalizes a raw phone to E.164 via optionalPhoneSchema', () => {
    const result = updateStudioProfileSchema.parse({ phone: '+52 984 123 4567' });
    expect(result.phone).toBe('+529841234567');
  });

  it('rejects an empty string name (still required when present)', () => {
    const result = updateStudioProfileSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an email longer than 254 characters', () => {
    const local = 'a'.repeat(250);
    const result = updateStudioProfileSchema.safeParse({ email: `${local}@x.io` });
    expect(result.success).toBe(false);
  });

  it('rejects hours array with wrong length', () => {
    const result = updateStudioProfileSchema.safeParse({
      hours: [{ weekday: 1, isOpen: false }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 7-entry hours array', () => {
    expect(() =>
      updateStudioProfileSchema.parse({
        hours: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, isOpen: false })),
      }),
    ).not.toThrow();
  });
});
