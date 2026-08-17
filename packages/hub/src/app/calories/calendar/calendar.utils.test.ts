import { describe, expect, it } from 'vitest';
import { buildMonthGridDays } from './calendar.utils';

describe('buildMonthGridDays', () => {
  it('pads a month that starts on a Saturday back to the preceding Monday', () => {
    const days = buildMonthGridDays('2026-08');
    expect(days[0]!.date).toBe('2026-07-27');
    expect(days[0]!.inMonth).toBe(false);
    expect(days.find(d => d.date === '2026-08-01')!.inMonth).toBe(true);
  });

  it('pads a month that ends on a Monday forward to the following Sunday', () => {
    const days = buildMonthGridDays('2026-08');
    expect(days[days.length - 1]!.date).toBe('2026-09-06');
    expect(days[days.length - 1]!.inMonth).toBe(false);
    expect(days.find(d => d.date === '2026-08-31')!.inMonth).toBe(true);
  });

  it('always returns a whole number of 7-day weeks', () => {
    expect(buildMonthGridDays('2026-08')).toHaveLength(42);
    // February 2026 starts on a Sunday (max leading pad) and has 28 days — 5 weeks, not 6.
    expect(buildMonthGridDays('2026-02')).toHaveLength(35);
  });

  it('marks every day exactly once as in-month or padding, with no gaps or duplicates', () => {
    const days = buildMonthGridDays('2026-02');
    const dates = days.map(d => d.date);
    expect(new Set(dates).size).toBe(dates.length);
    const inMonthDates = days.filter(d => d.inMonth).map(d => d.date);
    expect(inMonthDates).toHaveLength(28);
    expect(inMonthDates[0]).toBe('2026-02-01');
    expect(inMonthDates[inMonthDates.length - 1]).toBe('2026-02-28');
  });
});
