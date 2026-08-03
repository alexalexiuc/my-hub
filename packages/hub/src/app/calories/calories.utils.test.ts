import { describe, expect, it } from 'vitest';
import {
  calcCalorieDonutState,
  findPastWeight,
  formatDateLabel,
  getBaselineWeightForWeek,
  getDailyGoalDelta,
  groupByMealType,
  intakeBarColor,
  shiftDate,
  pctToGrams,
  gramsToPct,
  computeMacroSummary,
} from './calories.utils';
import type { MealLog } from '@my-hub/shared/types';
import { dateToString } from '@my-hub/shared/utils';

describe('shiftDate', () => {
  it('moves forward and back across a month boundary', () => {
    expect(shiftDate('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDate('2026-07-31', 1)).toBe('2026-08-01');
  });

  it('steps whole weeks, which is what the week navigation relies on', () => {
    expect(shiftDate('2026-08-03', -7)).toBe('2026-07-27');
    expect(shiftDate('2026-07-27', 7)).toBe('2026-08-03');
  });

  it('crosses a leap day', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('returns the same date for a zero shift', () => {
    expect(shiftDate('2026-08-01', 0)).toBe('2026-08-01');
  });
});

describe('formatDateLabel', () => {
  it('names today and yesterday rather than printing their dates', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    expect(formatDateLabel(dateToString(now))).toBe('Today');
    expect(formatDateLabel(dateToString(yesterday))).toBe('Yesterday');
  });

  // A fixed date in the past, deliberately far from now: a date near today would start matching
  // the "Today"/"Yesterday" branches as the calendar moves and fail on its own anniversary.
  it('falls back to a short weekday-and-date form for anything older', () => {
    expect(formatDateLabel('2020-03-14')).toBe('Sat, Mar 14');
  });
});

describe('groupByMealType', () => {
  const meal = (mealType: string, description: string) => ({ mealType, description }) as MealLog;

  it('collects meals of the same type in insertion order', () => {
    const grouped = groupByMealType([meal('lunch', 'a'), meal('breakfast', 'b'), meal('lunch', 'c')]);

    expect(Object.keys(grouped).sort()).toEqual(['breakfast', 'lunch']);
    expect(grouped.lunch!.map(m => m.description)).toEqual(['a', 'c']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupByMealType([])).toEqual({});
  });
});

describe('calcCalorieDonutState', () => {
  it('is green inside the range', () => {
    const state = calcCalorieDonutState(1500, 2000, 1200);
    expect(state).toMatchObject({ isOver: false, isUnder: false, remaining: 500, arcColor: '#4ade80' });
  });

  it('turns amber below the minimum', () => {
    expect(calcCalorieDonutState(900, 2000, 1200)).toMatchObject({ isUnder: true, arcColor: '#facc15' });
  });

  it('turns red past the cap and stops counting down at zero', () => {
    const state = calcCalorieDonutState(2400, 2000, 1200);
    expect(state).toMatchObject({ isOver: true, remaining: 0, arcColor: '#ef4444' });
    // The overflow ring shows the excess, capped at one full turn.
    expect(state.overflowData[0]).toEqual({ value: 400, key: 'overflow' });
  });

  it('caps the overflow ring at a full turn when intake more than doubles the cap', () => {
    expect(calcCalorieDonutState(5000, 2000, null).overflowData[0]).toEqual({ value: 2000, key: 'overflow' });
  });

  it('renders a neutral empty ring when no cap is set', () => {
    const state = calcCalorieDonutState(1500, null);
    expect(state).toMatchObject({ isOver: false, remaining: null, arcColor: '#3f3f46' });
    expect(state.chartData).toEqual([{ value: 1, key: 'empty' }]);
  });
});

describe('getDailyGoalDelta', () => {
  it('spreads a weekly loss rate over seven days, as a negative', () => {
    expect(getDailyGoalDelta('weight_loss', 0.7)).toBeCloseTo(-0.1);
  });

  it('spreads a weekly gain rate as a positive', () => {
    expect(getDailyGoalDelta('weight_gain', 0.7)).toBeCloseTo(0.1);
  });

  it('is flat for a maintain goal, with or without a rate', () => {
    expect(getDailyGoalDelta('maintain', null)).toBe(0);
    expect(getDailyGoalDelta('maintain', 0.5)).toBe(0);
  });

  it('has no answer when the rate is missing, zero or negative', () => {
    expect(getDailyGoalDelta('weight_loss', null)).toBeNull();
    expect(getDailyGoalDelta('weight_loss', 0)).toBeNull();
    // A negative rate would describe a loss goal that gains — refuse rather than invert it.
    expect(getDailyGoalDelta('weight_loss', -0.5)).toBeNull();
  });

  it('has no answer for an unset or unknown goal', () => {
    expect(getDailyGoalDelta(null, 0.5)).toBeNull();
    expect(getDailyGoalDelta('bulk', 0.5)).toBeNull();
  });
});

describe('getBaselineWeightForWeek', () => {
  // Sorted newest first, as the component sorts them.
  const rows = [
    { date: '2026-08-05', value: 76 },
    { date: '2026-08-03', value: 77 },
    { date: '2026-07-28', value: 78 },
  ];

  it('prefers the weigh-in on the week start itself', () => {
    expect(getBaselineWeightForWeek(rows, '2026-08-03')).toBe(77);
  });

  it('falls back to the most recent weigh-in before the week', () => {
    expect(getBaselineWeightForWeek(rows, '2026-08-04')).toBe(77);
  });

  it('uses the newest entry when the whole history postdates the week', () => {
    // Someone who only started weighing mid-week still gets a line to compare against.
    expect(getBaselineWeightForWeek(rows, '2026-07-01')).toBe(76);
  });

  it('returns null when there is no weight history at all', () => {
    expect(getBaselineWeightForWeek([], '2026-08-03')).toBeNull();
  });
});

describe('findPastWeight', () => {
  const rows = [
    { date: '2026-08-05', value: 76 },
    { date: '2026-08-03', value: 77 },
  ];

  it('returns the exact day’s weight', () => {
    expect(findPastWeight(rows, '2026-08-03')).toBe(77);
  });

  it('leaves a gap for a day with no weigh-in', () => {
    expect(findPastWeight(rows, '2026-08-04')).toBeNull();
  });

  it('falls back to the most recent earlier weigh-in only when asked', () => {
    expect(findPastWeight(rows, '2026-08-04', true)).toBe(77);
  });

  it('has nothing to fall back to before the first entry', () => {
    expect(findPastWeight(rows, '2026-08-01', true)).toBeNull();
  });
});

describe('intakeBarColor', () => {
  it('is green between the floor and the ceiling', () => {
    expect(intakeBarColor(1800, 1500, 2000)).toBe('var(--green)');
  });

  it('is red past the ceiling and amber below the floor', () => {
    expect(intakeBarColor(2100, 1500, 2000)).toBe('var(--red)');
    expect(intakeBarColor(1200, 1500, 2000)).toBe('var(--accent)');
  });

  it('marks an unlogged day rather than calling it under target', () => {
    expect(intakeBarColor(0, 1500, 2000)).toBe('var(--border)');
  });

  it('stays neutral when the profile yields no bound to judge against', () => {
    expect(intakeBarColor(1800, null, null)).toBe('var(--subtle)');
  });

  it('judges against whichever single bound exists', () => {
    expect(intakeBarColor(2100, null, 2000)).toBe('var(--red)');
    expect(intakeBarColor(1200, 1500, null)).toBe('var(--accent)');
  });
});

describe('pctToGrams', () => {
  it('converts percentage to grams for protein/carbs (4 kcal/g)', () => {
    expect(pctToGrams('30', 4, 2000)).toBe('150');
  });

  it('converts percentage to grams for fat (9 kcal/g)', () => {
    expect(pctToGrams('20', 9, 2000)).toBe('44');
  });

  it('returns empty string when pct is empty', () => {
    expect(pctToGrams('', 4, 2000)).toBe('');
  });

  it('returns empty string when maxCalNum is 0', () => {
    expect(pctToGrams('30', 4, 0)).toBe('');
  });

  it('rounds to nearest integer', () => {
    expect(pctToGrams('33', 4, 2000)).toBe('165');
  });
});

describe('gramsToPct', () => {
  it('converts grams to percentage for protein/carbs (4 kcal/g)', () => {
    expect(gramsToPct('150', 4, 2000)).toBe('30');
  });

  it('converts grams to percentage for fat (9 kcal/g)', () => {
    expect(gramsToPct('44', 9, 2000)).toBe('20');
  });

  it('returns empty string when grams is empty', () => {
    expect(gramsToPct('', 4, 2000)).toBe('');
  });

  it('returns empty string when maxCalNum is 0', () => {
    expect(gramsToPct('150', 4, 0)).toBe('');
  });

  it('rounds to nearest integer', () => {
    expect(gramsToPct('100', 4, 2000)).toBe('20');
  });

  it('is roughly inverse of pctToGrams', () => {
    const grams = pctToGrams('25', 4, 2000);
    expect(gramsToPct(grams, 4, 2000)).toBe('25');
  });
});

describe('computeMacroSummary', () => {
  it('returns used/remaining for % mode', () => {
    const result = computeMacroSummary('%', '30', '40', '20', null);
    expect(result).toEqual({ used: 90, remaining: 10, isOver: false });
  });

  it('sets isOver when % total exceeds 100', () => {
    const result = computeMacroSummary('%', '40', '40', '30', null);
    expect(result).toEqual({ used: 110, remaining: -10, isOver: true });
  });

  it('returns used/remaining for g mode with maxCalNum', () => {
    // 150g protein * 4 = 600 kcal = 30%, 200g carbs * 4 = 800 kcal = 40%, 44g fat * 9 = 396 ≈ 20%
    const result = computeMacroSummary('g', '150', '200', '44', 2000);
    expect(result).toEqual({ used: 90, remaining: 10, isOver: false });
  });

  it('sets isOver when g mode total exceeds 100%', () => {
    const result = computeMacroSummary('g', '200', '200', '100', 2000);
    expect(result!.isOver).toBe(true);
  });

  it('returns null for g mode without maxCalNum', () => {
    expect(computeMacroSummary('g', '150', '200', '44', null)).toBeNull();
  });
});
