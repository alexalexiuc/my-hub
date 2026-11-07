import { describe, expect, it } from 'vitest';
import { formatKcalRange, planStatusLabel, planWeek, rangeBarPositions } from './menu.utils';
import type { DayTarget } from './menu.utils';
import type { WeeklyMenuMeal } from './types';

// Mon, Wed, Thu, Fri train: 3,200–3,300 there, 2,900–3,000 on the other days.
const GYM = new Set([0, 2, 3, 4]);
const dayTargets: DayTarget[] = [0, 1, 2, 3, 4, 5, 6].map(d =>
  GYM.has(d)
    ? { target: 3300, min: 3200, isGymDay: true, gymDayBonus: 300 }
    : { target: 3000, min: 2900, isGymDay: false, gymDayBonus: 300 },
);
const meals = (kcal: number) => [{ kcal } as WeeklyMenuMeal];
const planOne = (day: number, kcal: number | null, targets = dayTargets) =>
  planWeek(kcal === null ? {} : { [day]: meals(kcal) }, targets).days[day as 0];

describe('planWeek', () => {
  it("takes each day's range as given and labels gym and recovery days", () => {
    expect(planOne(0, 3260)).toMatchObject({ kind: 'gym', bonusKcal: 300, floor: 3200, ceiling: 3300 });
    expect(planOne(0, 3260).status).toBe('on_target');
    expect(planOne(5, 2950)).toMatchObject({ kind: 'recovery', bonusKcal: 0, floor: 2900, ceiling: 3000 });
  });

  it('judges a day under, over or inside its own range', () => {
    expect(planOne(5, 3100).status).toBe('over');
    expect(planOne(5, 2800).status).toBe('under');
  });

  it('calls no day "recovery" when the user has no gym days', () => {
    const noGym = dayTargets.map(t => ({ ...t, isGymDay: false, target: 3000, min: 2900 }));
    expect(planOne(0, 2950, noGym).kind).toBeNull();
  });

  it('has nothing to judge without a real target, but still draws a fallback ceiling', () => {
    const none = dayTargets.map(t => ({ ...t, target: null, min: null }));
    expect(planOne(1, 2000, none)).toMatchObject({ status: 'no_target', isEstimated: true, ceiling: 2000 });
  });

  it('drops the floor when the ceiling is only an estimate, so the range never runs backwards', () => {
    const minOnly = dayTargets.map(t => ({ ...t, target: null, min: 2500 }));
    expect(planOne(1, 2000, minOnly)).toMatchObject({ floor: null, ceiling: 2000, isEstimated: true });
  });

  it('sums the week over the planned days only', () => {
    const { week } = planWeek({ 0: meals(3260), 5: meals(2950) }, dayTargets);
    expect(week).toMatchObject({ plannedKcal: 6210, ceiling: 6300, floor: 6100, status: 'on_target', kind: null });
  });
});

describe('planStatusLabel', () => {
  it('names the gap to the range', () => {
    expect(planStatusLabel(planOne(2, 3180))).toBe('20 under');
    expect(planStatusLabel(planOne(4, 3350))).toBe('50 over');
    expect(planStatusLabel(planOne(3, 3240))).toBe('On target');
    expect(planStatusLabel(planOne(6, null))).toBeNull();
  });
});

describe('formatKcalRange', () => {
  it('prints a range, or the ceiling alone without a floor', () => {
    expect(formatKcalRange(2900, 3000)).toBe('2,900–3,000');
    expect(formatKcalRange(null, 3000)).toBe('3,000');
  });
});

describe('rangeBarPositions', () => {
  it('fills from zero, with both ticks inside the bar and the fill between them when on target', () => {
    const { fill, floorTick, ceilingTick } = rangeBarPositions(2950, 2900, 3000);
    expect(floorTick).toBeGreaterThan(0);
    expect(ceilingTick).toBeLessThan(100);
    expect(fill).toBeGreaterThan(floorTick!);
    expect(fill).toBeLessThan(ceilingTick);
  });

  it('clamps an overshoot to the full bar and leaves out a missing floor', () => {
    expect(rangeBarPositions(99999, 2900, 3000).fill).toBe(100);
    expect(rangeBarPositions(1000, null, 3000).floorTick).toBeNull();
  });
});
