/**
 * Tests for format.ts utilities.
 *
 * Ref: docs/architecture/CU-869d29f21-service-catalog.md §10d, §10e
 */

import { describe, expect, it } from 'vitest';
import { formatDurationMinutes, formatMxnPrice } from './format';

describe('formatMxnPrice', () => {
  it('formats 1200 pesos in es-MX locale', () => {
    const result = formatMxnPrice(1200, 'es');
    // es-MX produces "$1,200" with MXN symbol
    expect(result).toMatch(/1[,.]?200/);
    expect(result).not.toContain('.');
  });

  it('formats 1200 pesos in en-US locale', () => {
    const result = formatMxnPrice(1200, 'en');
    // en-US produces "MX$1,200"
    expect(result).toMatch(/1[,.]?200/);
    expect(result).not.toContain('.');
  });

  it('formats 0 pesos', () => {
    const result = formatMxnPrice(0, 'es');
    expect(result).toMatch(/0/);
  });

  it('does not include decimal places for whole-peso amounts', () => {
    const esResult = formatMxnPrice(500, 'es');
    const enResult = formatMxnPrice(500, 'en');
    // Should not have ".00" or ",00"
    expect(esResult).not.toMatch(/[,.]00$/);
    expect(enResult).not.toMatch(/[,.]00$/);
  });

  it('includes MX indicator for en-US to disambiguate from USD', () => {
    const result = formatMxnPrice(1200, 'en');
    // Should include MX prefix or MXN symbol
    expect(result).toMatch(/MX|MXN/);
  });
});

describe('formatDurationMinutes', () => {
  it('formats minutes less than 60 as "{n} min"', () => {
    expect(formatDurationMinutes(30)).toBe('30 min');
    expect(formatDurationMinutes(45)).toBe('45 min');
  });

  it('formats exactly 60 minutes as "1 hr"', () => {
    expect(formatDurationMinutes(60)).toBe('1 hr');
  });

  it('formats exactly 120 minutes as "2 hr"', () => {
    expect(formatDurationMinutes(120)).toBe('2 hr');
  });

  it('formats 90 minutes as "1 hr 30 min"', () => {
    expect(formatDurationMinutes(90)).toBe('1 hr 30 min');
  });

  it('formats 105 minutes as "1 hr 45 min"', () => {
    expect(formatDurationMinutes(105)).toBe('1 hr 45 min');
  });

  it('formats 150 minutes as "2 hr 30 min"', () => {
    expect(formatDurationMinutes(150)).toBe('2 hr 30 min');
  });

  it('formats 180 minutes as "3 hr"', () => {
    expect(formatDurationMinutes(180)).toBe('3 hr');
  });

  it('formats 1 minute as "1 min"', () => {
    expect(formatDurationMinutes(1)).toBe('1 min');
  });

  it('formats 55 minutes as "55 min"', () => {
    expect(formatDurationMinutes(55)).toBe('55 min');
  });
});
