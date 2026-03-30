import { describe, expect, it } from 'vitest';
import { isValidDate, addMinutes, addHours } from './dates';

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

describe('addMinutes', () => {
  it('adds minutes to a date', () => {
    const date = new Date('2026-03-23T00:00:00.000Z');
    const result = addMinutes(date, 30);
    expect(result.getTime()).toBe(new Date('2026-03-23T00:30:00.000Z').getTime());
  });

  it('handles negative minutes', () => {
    const date = new Date('2026-03-23T00:00:00.000Z');
    const result = addMinutes(date, -15);
    expect(result.getTime()).toBe(new Date('2026-03-22T23:45:00.000Z').getTime());
  });
});

describe('addHours', () => {
  it('adds hours to a date', () => {
    const date = new Date('2026-03-23T00:00:00.000Z');
    const result = addHours(date, 2);
    expect(result.getTime()).toBe(new Date('2026-03-23T02:00:00.000Z').getTime());
  });

  it('handles negative hours', () => {
    const date = new Date('2026-03-23T00:00:00.000Z');
    const result = addHours(date, -1);
    expect(result.getTime()).toBe(new Date('2026-03-22T23:00:00.000Z').getTime());
  });
});
