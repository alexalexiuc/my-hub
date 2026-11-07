import { describe, expect, it } from 'vitest';
import type { MealEntry } from '../types';
import { summariseHistoryDays } from './history';

// Mon, Wed, Thu, Fri train: 3,200–3,300 there, 2,900–3,000 on the other days.
const profile = { goalMaxCalories: 3000, goalMinCalories: 2900, gymDays: [0, 2, 3, 4], gymDayCalorieBonus: 300 };
const meal = (date: string, calories: number) =>
  ({ date, calories, proteinG: null, carbsG: null, fatG: null }) as MealEntry;

// 2026-11-02 is a Monday; "today" is Wednesday 2026-11-04.
const run = (meals: MealEntry[], p: object = profile) =>
  summariseHistoryDays(meals, p, null, '2026-11-01', '2026-11-04', '2026-11-04');

describe('summariseHistoryDays', () => {
  it('judges each finished day against its own range and gives today no verdict', () => {
    const { days } = run([
      meal('2026-11-02', 3250), // Monday, gym day: inside 3,200–3,300
      meal('2026-11-03', 3100), // Tuesday, recovery: over 3,000
      meal('2026-11-04', 400), // Wednesday is today: breakfast only
    ]);
    const byDate = Object.fromEntries(days.map(d => [d.date, d]));

    expect(byDate['2026-11-01']).toMatchObject({ isGymDay: false, mealCount: 0, status: 'not_logged' });
    expect(byDate['2026-11-02']).toMatchObject({ isGymDay: true, dayTarget: 3300, dayMin: 3200, status: 'on_target' });
    expect(byDate['2026-11-03']).toMatchObject({ isGymDay: false, dayTarget: 3000, status: 'over' });
    expect(byDate['2026-11-04']).toMatchObject({ isGymDay: true, calories: 400, status: null });
  });

  it("sums the days' own ceilings into periodTarget, gym bonus included", () => {
    // Sun 3,000 + Mon 3,300 + Tue 3,000 + Wed 3,300.
    const summary = run([meal('2026-11-02', 3250), meal('2026-11-02', 50)]);
    expect(summary.periodTarget).toBe(12600);
    expect(summary.totalCalories).toBe(3300);
    expect(summary.periodRemaining).toBe(9300);
    expect(summary.averageDailyCalories).toBe(3300);
  });

  it('has no period target when the profile cannot produce one', () => {
    const summary = run([meal('2026-11-02', 2000)], { gymDays: [0] });
    expect(summary.periodTarget).toBeNull();
    expect(summary.periodRemaining).toBeNull();
    expect(summary.days.every(d => d.dayTarget === null)).toBe(true);
  });
});
