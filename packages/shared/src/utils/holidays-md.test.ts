import { describe, expect, it } from 'vitest';
import { moldovaPublicHolidays, orthodoxEasterDate } from './holidays-md';

describe('orthodoxEasterDate', () => {
  it('matches known Orthodox Easter dates', () => {
    expect(orthodoxEasterDate(2024)).toBe('2024-05-05');
    expect(orthodoxEasterDate(2025)).toBe('2025-04-20');
    expect(orthodoxEasterDate(2026)).toBe('2026-04-12');
    expect(orthodoxEasterDate(2027)).toBe('2027-05-02');
  });
});

describe('moldovaPublicHolidays', () => {
  it('lists the 13 art. 111 days for 2026, Easter-dependent ones included', () => {
    expect(moldovaPublicHolidays(2026).map(h => h.date)).toEqual([
      '2026-01-01',
      '2026-01-07',
      '2026-01-08',
      '2026-03-08',
      '2026-04-12',
      '2026-04-13',
      '2026-04-20',
      '2026-05-01',
      '2026-05-09',
      '2026-06-01',
      '2026-08-27',
      '2026-08-31',
      '2026-12-25',
    ]);
  });

  it('keeps the list sorted when Easter falls in May', () => {
    const dates = moldovaPublicHolidays(2027).map(h => h.date);
    expect(dates.slice(4, 9)).toEqual(['2027-05-01', '2027-05-02', '2027-05-03', '2027-05-09', '2027-05-10']);
  });
});
