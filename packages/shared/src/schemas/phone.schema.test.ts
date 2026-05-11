import { describe, it, expect } from 'vitest';
import { phoneSchema, optionalPhoneSchema } from './phone.schema.js';

describe('phoneSchema', () => {
  it('normalizes a valid Mexican number with country code to E.164', () => {
    const result = phoneSchema.safeParse('+52 984 123 4567');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('+529841234567');
    }
  });

  it('normalizes a bare 10-digit Mexican number to E.164 using MX default', () => {
    const result = phoneSchema.safeParse('9841234567');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('+529841234567');
    }
  });

  it('normalizes a US number with country code to E.164', () => {
    const result = phoneSchema.safeParse('+1 212 555 0100');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('+12125550100');
    }
  });

  it('rejects a clearly invalid phone number', () => {
    const result = phoneSchema.safeParse('not-a-phone');
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = phoneSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects a number that is too short', () => {
    const result = phoneSchema.safeParse('123');
    expect(result.success).toBe(false);
  });
});

describe('optionalPhoneSchema', () => {
  it('returns null for null input', () => {
    const result = optionalPhoneSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('returns null for undefined input', () => {
    const result = optionalPhoneSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('returns null for empty string', () => {
    const result = optionalPhoneSchema.safeParse('');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('normalizes a valid phone number to E.164', () => {
    const result = optionalPhoneSchema.safeParse('+52 984 123 4567');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('+529841234567');
    }
  });

  it('rejects an invalid phone number', () => {
    const result = optionalPhoneSchema.safeParse('not-a-phone');
    expect(result.success).toBe(false);
  });
});
