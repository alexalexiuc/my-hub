import { describe, expect, it } from 'vitest';
import { isValidDate, addMinutes, addHours, toUTCDateStr, addDays, getISOWeek } from './dates';

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

describe('toUTCDateStr', () => {
  it('formats a UTC midnight date as YYYY-MM-DD', () => {
    expect(toUTCDateStr(new Date('2026-03-23T00:00:00.000Z'))).toBe('2026-03-23');
  });

  it('uses UTC components, not local time', () => {
    // 2026-01-01T00:30:00Z is still Jan 1 in UTC
    expect(toUTCDateStr(new Date('2026-01-01T00:30:00.000Z'))).toBe('2026-01-01');
  });

  it('does not bleed into the next day for late-UTC times', () => {
    expect(toUTCDateStr(new Date('2026-12-31T23:59:59.000Z'))).toBe('2026-12-31');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(toUTCDateStr(addDays(new Date('2026-03-23T00:00:00.000Z'), 1))).toBe('2026-03-24');
  });

  it('subtracts days with negative n', () => {
    expect(toUTCDateStr(addDays(new Date('2026-03-23T00:00:00.000Z'), -1))).toBe('2026-03-22');
  });

  it('crosses month boundaries', () => {
    expect(toUTCDateStr(addDays(new Date('2026-01-31T00:00:00.000Z'), 1))).toBe('2026-02-01');
  });

  it('crosses year boundaries', () => {
    expect(toUTCDateStr(addDays(new Date('2026-12-31T00:00:00.000Z'), 1))).toBe('2027-01-01');
  });

  it('does not mutate the original date', () => {
    const original = new Date('2026-03-23T00:00:00.000Z');
    addDays(original, 5);
    expect(toUTCDateStr(original)).toBe('2026-03-23');
  });
});

describe('getISOWeek', () => {
  it('returns week 1 for 2026-01-01 (Thursday)', () => {
    expect(getISOWeek(new Date('2026-01-01T00:00:00.000Z'))).toBe(1);
  });

  it('returns week 53 for 2026-12-31 (Thursday — last week of 2026)', () => {
    expect(getISOWeek(new Date('2026-12-31T00:00:00.000Z'))).toBe(53);
  });

  it('returns week 1 for 2024-01-01 (Monday)', () => {
    expect(getISOWeek(new Date('2024-01-01T00:00:00.000Z'))).toBe(1);
  });

  it('returns correct week mid-year', () => {
    // 2026-04-06 is a Monday — start of week 15
    expect(getISOWeek(new Date('2026-04-06T00:00:00.000Z'))).toBe(15);
    // 2026-04-12 is a Sunday — end of week 15
    expect(getISOWeek(new Date('2026-04-12T00:00:00.000Z'))).toBe(15);
    // 2026-04-13 is a Monday — start of week 16
    expect(getISOWeek(new Date('2026-04-13T00:00:00.000Z'))).toBe(16);
  });

  it('handles Sunday as end of week (not start)', () => {
    // 2026-03-29 is a Sunday — end of week 13
    expect(getISOWeek(new Date('2026-03-29T00:00:00.000Z'))).toBe(13);
    // 2026-03-30 is a Monday — start of week 14
    expect(getISOWeek(new Date('2026-03-30T00:00:00.000Z'))).toBe(14);
  });
});
