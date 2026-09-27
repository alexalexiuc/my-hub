import { describe, expect, it } from 'vitest';
import { createVacationModel } from '../../utils/vacation';
import { buildVacationDemo } from './demo';

describe('buildVacationDemo', () => {
  const today = '2026-09-27';
  const { profile, input } = buildVacationDemo(today);
  const model = createVacationModel({ ...input, includeDraftRules: false, includePlanned: true });

  it('prices leave this month from the demo salaries', () => {
    const rate = model.rateFor(today);
    expect(rate?.windowMonths).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(rate!.calendarDayRate).toBeGreaterThan(0);
  });

  it('shows the taken and planned demo leave on the calendar', () => {
    const markers = model.calendar('2026-08-01', '2026-11-30').rows.flatMap(r => r[4]);
    expect(markers).toContain('leave_taken');
    expect(markers).toContain('leave_planned');
    expect(markers).toContain('holiday');
  });

  it('accrues from the opening balance and charges the taken leave', () => {
    expect(profile.openingBalanceDate).toBe('2026-03-01');
    const balance = model.balanceOn(today).totalDays;
    expect(balance).toBeGreaterThan(14);
    expect(balance).toBeLessThan(14 + 28);
  });

  it('covers holidays through two years ahead', () => {
    expect(input.holidays.some(h => h.date === '2028-12-25')).toBe(true);
  });
});
