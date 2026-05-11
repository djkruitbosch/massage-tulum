import { describe, it, expect } from 'vitest';
import { trimTime, isValidHHMM } from './time.js';

describe('trimTime', () => {
  it('trims HH:MM:SS to HH:MM', () => {
    expect(trimTime('09:00:00')).toBe('09:00');
  });

  it('trims HH:MM:SS with non-zero seconds', () => {
    expect(trimTime('21:30:45')).toBe('21:30');
  });

  it('leaves already-trimmed HH:MM unchanged', () => {
    expect(trimTime('09:00')).toBe('09:00');
  });

  it('trims midnight correctly', () => {
    expect(trimTime('00:00:00')).toBe('00:00');
  });

  it('trims end-of-day time correctly', () => {
    expect(trimTime('23:59:00')).toBe('23:59');
  });
});

describe('isValidHHMM', () => {
  it('accepts valid midnight time', () => {
    expect(isValidHHMM('00:00')).toBe(true);
  });

  it('accepts valid noon time', () => {
    expect(isValidHHMM('12:00')).toBe(true);
  });

  it('accepts valid end-of-day time', () => {
    expect(isValidHHMM('23:59')).toBe(true);
  });

  it('rejects hour 24', () => {
    expect(isValidHHMM('24:00')).toBe(false);
  });

  it('rejects minute 60', () => {
    expect(isValidHHMM('12:60')).toBe(false);
  });

  it('rejects HH:MM:SS format (includes seconds)', () => {
    expect(isValidHHMM('09:00:00')).toBe(false);
  });

  it('rejects arbitrary string', () => {
    expect(isValidHHMM('not-a-time')).toBe(false);
  });

  it('rejects single-digit hour without leading zero', () => {
    expect(isValidHHMM('9:00')).toBe(false);
  });
});
