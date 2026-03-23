import { describe, expect, it } from 'vitest';
import { isValidDate } from './dates';

describe('isValidDate', () => {
  it('returns true for valid Date objects', () => {
    expect(isValidDate(new Date('2026-03-23T00:00:00.000Z'))).toBe(true);
    expect(isValidDate(new Date())).toBe(true);
  });

  it('returns false for invalid Date objects', () => {
    expect(isValidDate(new Date('invalid-date'))).toBe(false);
  });

  it('returns false for non-Date values', () => {
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate('2026-03-23T00:00:00.000Z')).toBe(false);
    expect(isValidDate(123)).toBe(false);
    expect(isValidDate({})).toBe(false);
  });
});
