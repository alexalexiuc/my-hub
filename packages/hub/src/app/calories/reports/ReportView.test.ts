import { describe, expect, it } from 'vitest';
import { PERIODS, parsePeriodParam } from './ReportView';

describe('parsePeriodParam', () => {
  it('reads a well-formed date as UTC midnight', () => {
    // UTC, not local: the report endpoints address periods in UTC terms, and parsing at local
    // midnight lands on the previous UTC day in any positive-offset timezone.
    expect(parsePeriodParam('2026-07-27')?.toISOString()).toBe('2026-07-27T00:00:00.000Z');
  });

  it('ignores a missing or malformed param rather than producing an Invalid Date', () => {
    expect(parsePeriodParam(null)).toBeUndefined();
    expect(parsePeriodParam('')).toBeUndefined();
    expect(parsePeriodParam('27-07-2026')).toBeUndefined();
    expect(parsePeriodParam('2026-7-27')).toBeUndefined();
    expect(parsePeriodParam('last-week')).toBeUndefined();
  });

  // The shape check alone passes these. The Invalid Date ones reach `toUTCDateStr` during render,
  // where `toISOString` throws and blanks the page.
  it('rejects a date with the right shape but no place in the calendar', () => {
    expect(parsePeriodParam('2026-13-45')).toBeUndefined();
    expect(parsePeriodParam('2026-00-10')).toBeUndefined();
  });

  // Not an Invalid Date at all — JS rolls February 31st over to March 3rd, so a NaN check lets it
  // through and the reader silently gets a different period than the link named.
  it('rejects a date that rolls over into the next month', () => {
    expect(new Date('2026-02-31T00:00:00Z').toISOString()).toBe('2026-03-03T00:00:00.000Z');
    expect(parsePeriodParam('2026-02-31')).toBeUndefined();
    expect(parsePeriodParam('2025-02-29')).toBeUndefined();
  });

  it('still accepts a real leap day', () => {
    expect(parsePeriodParam('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('PERIODS', () => {
  it('steps a week forwards and back', () => {
    const monday = new Date('2026-07-27T00:00:00Z');
    expect(PERIODS.weekly.step(monday, 1).toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(PERIODS.weekly.step(monday, -1).toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('steps a month forwards and back, landing on the first', () => {
    const first = new Date('2026-08-01T00:00:00Z');
    expect(PERIODS.monthly.step(first, 1).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(PERIODS.monthly.step(first, -1).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('crosses a year boundary in both directions', () => {
    expect(PERIODS.monthly.step(new Date('2026-01-01T00:00:00Z'), -1).toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(PERIODS.monthly.step(new Date('2026-12-01T00:00:00Z'), 1).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('addresses each period through its own endpoint and query param', () => {
    expect(PERIODS.weekly).toMatchObject({ param: 'weekStart', endpoint: expect.stringContaining('weekly-preview') });
    expect(PERIODS.monthly).toMatchObject({
      param: 'monthStart',
      endpoint: expect.stringContaining('monthly-preview'),
    });
  });
});
