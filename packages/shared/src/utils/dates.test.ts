import { describe, expect, it } from 'vitest';
import {
  isValidDate,
  addMinutes,
  addHours,
  toUTCDateStr,
  addDays,
  getISOWeek,
  getLastMonthStart,
  addMonths,
  monthLabel,
  getLastMonday,
  isoWeekAndYear,
  weekLabel,
  isoDate,
  calendarDays,
} from './dates';

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

describe('getLastMonthStart', () => {
  it('returns first day of previous month in UTC', () => {
    const reference = new Date('2026-04-15T10:30:00.000Z');
    expect(toUTCDateStr(getLastMonthStart(reference))).toBe('2026-03-01');
  });

  it('crosses year boundary', () => {
    const reference = new Date('2026-01-10T12:00:00.000Z');
    expect(toUTCDateStr(getLastMonthStart(reference))).toBe('2025-12-01');
  });
});

describe('addMonths', () => {
  it('moves month start forward by one month', () => {
    expect(toUTCDateStr(addMonths(new Date('2026-03-01T00:00:00.000Z'), 1))).toBe('2026-04-01');
  });

  it('moves month start backward by one month', () => {
    expect(toUTCDateStr(addMonths(new Date('2026-03-01T00:00:00.000Z'), -1))).toBe('2026-02-01');
  });
});

describe('monthLabel', () => {
  it('formats month start as Month YYYY', () => {
    expect(monthLabel(new Date('2026-03-01T00:00:00.000Z'))).toBe('March 2026');
  });
});

describe('getLastMonday', () => {
  it('returns Monday of previous week for a mid-week reference date', () => {
    const reference = new Date('2026-04-15T10:30:00.000Z'); // Wednesday
    expect(toUTCDateStr(getLastMonday(reference))).toBe('2026-04-06');
  });

  it('returns previous Monday when reference date is Monday', () => {
    const reference = new Date('2026-04-13T10:30:00.000Z');
    expect(toUTCDateStr(getLastMonday(reference))).toBe('2026-04-06');
  });

  it('handles Sunday correctly as end of week', () => {
    const reference = new Date('2026-04-12T10:30:00.000Z');
    expect(toUTCDateStr(getLastMonday(reference))).toBe('2026-03-30');
  });
});

describe('isoWeekAndYear', () => {
  it('returns ISO week and ISO week-year', () => {
    expect(isoWeekAndYear(new Date('2021-01-01T00:00:00.000Z'))).toEqual({ week: 53, year: 2020 });
  });

  it('returns expected week/year mid-year', () => {
    expect(isoWeekAndYear(new Date('2026-04-13T00:00:00.000Z'))).toEqual({ week: 16, year: 2026 });
  });
});

describe('weekLabel', () => {
  it('formats ISO week label', () => {
    expect(weekLabel(new Date('2026-04-13T00:00:00.000Z'))).toBe('Week 16, 2026');
  });
});

describe('isoDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(isoDate(new Date('2026-03-23T00:00:00.000Z'))).toBe('2026-03-23');
  });
});

describe('calendarDays', () => {
  it('returns array of date strings between start and end dates', () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    const end = new Date('2026-03-05T00:00:00.000Z');
    expect(calendarDays(start, end)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
  });

  it('handles same start and end date', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');
    expect(calendarDays(date, date)).toEqual(['2026-03-01']);
  });

  it('handles end date before start date by returning empty array', () => {
    const start = new Date('2026-03-05T00:00:00.000Z');
    const end = new Date('2026-03-01T00:00:00.000Z');
    expect(calendarDays(start, end)).toEqual([]);
  });
});
