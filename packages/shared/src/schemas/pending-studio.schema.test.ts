import { describe, expect, it } from 'vitest';
import {
  createPendingStudioSchema,
  rejectStudioSchema,
  signupResponseSchema,
} from './pending-studio.schema.js';

describe('createPendingStudioSchema', () => {
  const valid = {
    email: 'owner@mystudio.com',
    studioName: 'My Studio',
    description: 'A great studio in Tulum',
    locale: 'en' as const,
  };

  it('accepts a valid English signup payload', () => {
    expect(() => createPendingStudioSchema.parse(valid)).not.toThrow();
  });

  it('accepts a valid Spanish signup payload with optional phone', () => {
    expect(() =>
      createPendingStudioSchema.parse({ ...valid, locale: 'es', contactPhone: '+52 984 123 4567' }),
    ).not.toThrow();
  });

  it('accepts null contactPhone', () => {
    expect(() => createPendingStudioSchema.parse({ ...valid, contactPhone: null })).not.toThrow();
  });

  it('rejects missing email', () => {
    const { email: _email, ...withoutEmail } = valid;
    void _email;
    expect(() => createPendingStudioSchema.parse(withoutEmail)).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() => createPendingStudioSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
  });

  it('rejects email over 254 chars', () => {
    const longEmail = 'a'.repeat(243) + '@example.com'; // 255 chars total
    expect(() => createPendingStudioSchema.parse({ ...valid, email: longEmail })).toThrow();
  });

  it('rejects empty studioName', () => {
    expect(() => createPendingStudioSchema.parse({ ...valid, studioName: '' })).toThrow();
  });

  it('rejects studioName over 100 chars', () => {
    expect(() =>
      createPendingStudioSchema.parse({ ...valid, studioName: 'a'.repeat(101) }),
    ).toThrow();
  });

  it('rejects empty description', () => {
    expect(() => createPendingStudioSchema.parse({ ...valid, description: '' })).toThrow();
  });

  it('rejects description over 1000 chars', () => {
    expect(() =>
      createPendingStudioSchema.parse({ ...valid, description: 'a'.repeat(1001) }),
    ).toThrow();
  });

  it('rejects invalid locale', () => {
    expect(() => createPendingStudioSchema.parse({ ...valid, locale: 'fr' })).toThrow();
  });

  it('rejects contactPhone over 20 chars', () => {
    expect(() =>
      createPendingStudioSchema.parse({ ...valid, contactPhone: '+'.repeat(21) }),
    ).toThrow();
  });
});

describe('signupResponseSchema', () => {
  it('accepts { status: "pending" }', () => {
    expect(() => signupResponseSchema.parse({ status: 'pending' })).not.toThrow();
  });

  it('rejects other status values', () => {
    expect(() => signupResponseSchema.parse({ status: 'approved' })).toThrow();
  });
});

describe('rejectStudioSchema', () => {
  it('accepts empty body', () => {
    expect(() => rejectStudioSchema.parse({})).not.toThrow();
  });

  it('accepts null reason', () => {
    expect(() => rejectStudioSchema.parse({ reason: null })).not.toThrow();
  });

  it('accepts a reason string', () => {
    expect(() => rejectStudioSchema.parse({ reason: 'Out of area' })).not.toThrow();
  });

  it('rejects reason over 500 chars', () => {
    expect(() => rejectStudioSchema.parse({ reason: 'a'.repeat(501) })).toThrow();
  });
});
