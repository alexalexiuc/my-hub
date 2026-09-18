import { describe, expect, it } from 'vitest';
import {
  averageWeeklyWeights,
  buildGoalProgressView,
  calcCalorieDonutState,
  formatDateLabel,
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

describe('buildGoalProgressView', () => {
  const anchor = { goalStartDate: '2026-09-07', goalStartWeightKg: 90 };

  /** A daily weigh-in series starting at `from`, each day `step` kg off the last. */
  const series = (from: string, start: number, step: number, days: number) =>
    Array.from({ length: days }, (_, i) => ({
      date: shiftDate(from, i),
      value: parseFloat((start + step * i).toFixed(3)),
    }));

  it('projects cumulatively, so a missed week is carried rather than forgiven', () => {
    // Two weeks of a 1 kg/week loss goal from 90 kg. Week one ended heavy at 91 (a hard weekend),
    // week two drifted back to 90.8. The old week-rebased card reset to 91 and called the second
    // week's target 90; anchored to the goal, the target after 14 days is 88.
    const view = buildGoalProgressView({
      weightHistory: [
        { date: '2026-09-07', value: 90 },
        { date: '2026-09-14', value: 91 },
        { date: '2026-09-21', value: 90.8 },
      ],
      profile: anchor,
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: '2026-09-07',
      today: '2026-09-21',
    });

    expect(view!.projectedTodayKg).toBeCloseTo(88);
    expect(view!.deltaKg).toBeGreaterThan(0); // behind, and honest about it
    expect(view!.anchor).toEqual({ date: '2026-09-07', weightKg: 90, source: 'profile' });
  });

  it('judges the goal on the smoothed trend, not the latest reading', () => {
    // Three flat weeks at 90, then one water-weight day at 92.
    const flat = series('2026-09-07', 90, 0, 21);
    const view = buildGoalProgressView({
      weightHistory: [...flat, { date: shiftDate('2026-09-07', 21), value: 92 }],
      profile: { goalStartDate: '2026-09-07', goalStartWeightKg: 90 },
      goalType: 'maintain',
      goalWeeklyRateKg: null,
      windowStart: '2026-09-07',
      today: shiftDate('2026-09-07', 21),
    });

    expect(view!.currentActualKg).toBe(92);
    // 2 kg on the scale moves the verdict by 0.2 kg, not 2.
    expect(view!.currentTrendKg).toBeCloseTo(90.2, 1);
    expect(Math.abs(view!.deltaKg)).toBeLessThan(0.3);
  });

  it('enters the window with a warm trend rather than restarting at the first day in view', () => {
    // A month at 96 then a week at 94: a window opening at the drop must not treat 94 as the
    // trend, or every range change would re-baseline the smoothing.
    const history = [...series('2026-08-01', 96, 0, 30), ...series('2026-08-31', 94, 0, 7)];
    const view = buildGoalProgressView({
      weightHistory: history,
      profile: { goalStartDate: '2026-08-01', goalStartWeightKg: 96 },
      goalType: 'weight_loss',
      goalWeeklyRateKg: 0.5,
      windowStart: '2026-08-31',
      today: '2026-09-06',
    });

    expect(view!.points[0]!.date).toBe('2026-08-31');
    // Still on its way down from 96, not sitting at 94.
    expect(view!.points[0]!.trend).toBeGreaterThan(95);
    expect(view!.points[0]!.actual).toBe(94);
  });

  it('reports the achieved rate alongside the goal rate, both signed', () => {
    const view = buildGoalProgressView({
      weightHistory: series('2026-09-07', 90, -0.1, 28),
      profile: { goalStartDate: '2026-09-07', goalStartWeightKg: 90 },
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: '2026-09-07',
      today: shiftDate('2026-09-07', 27),
    });

    expect(view!.goalRateKgPerWeek).toBeCloseTo(-1);
    // Losing 0.1 kg/day is 0.7 kg/week; the EMA lags, so allow a loose band.
    expect(view!.actualRateKgPerWeek!).toBeGreaterThan(-0.75);
    expect(view!.actualRateKgPerWeek!).toBeLessThan(-0.5);
  });

  it('measures total change against the anchor, not the window', () => {
    const view = buildGoalProgressView({
      weightHistory: series('2026-09-07', 90, -0.1, 28),
      profile: { goalStartDate: '2026-09-07', goalStartWeightKg: 90 },
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: shiftDate('2026-09-07', 21), // last week only
      today: shiftDate('2026-09-07', 27),
    });

    expect(view!.points).toHaveLength(7);
    // The trend is ~1.85 kg below the anchor after four weeks (it lags the raw 2.7 kg drop).
    // Window-scoped it would read about 0.5 kg — the week on screen — so this distinguishes them.
    expect(view!.totalChangeKg).toBeLessThan(-1.5);
  });

  it('falls back to an inferred anchor when the profile has no baseline, and says so', () => {
    const view = buildGoalProgressView({
      weightHistory: [
        { date: '2026-09-01', value: 97 },
        { date: '2026-09-08', value: 96 },
      ],
      profile: null,
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: '2026-09-01',
      today: '2026-09-08',
    });

    expect(view!.anchor).toEqual({ date: '2026-09-01', weightKg: 97, source: 'inferred' });
  });

  it('has nothing to draw without a usable goal, anchor or weigh-in', () => {
    const base = {
      weightHistory: [{ date: '2026-09-08', value: 96 }],
      profile: anchor,
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: '2026-09-01',
      today: '2026-09-08',
    };

    expect(buildGoalProgressView({ ...base, goalWeeklyRateKg: null })).toBeNull();
    expect(buildGoalProgressView({ ...base, goalType: null })).toBeNull();
    expect(buildGoalProgressView({ ...base, weightHistory: [], profile: null })).toBeNull();
  });

  it('ignores weigh-ins dated after today', () => {
    const view = buildGoalProgressView({
      weightHistory: [
        { date: '2026-09-08', value: 96 },
        { date: '2026-09-30', value: 95 },
      ],
      profile: anchor,
      goalType: 'weight_loss',
      goalWeeklyRateKg: 1,
      windowStart: '2026-09-01',
      today: '2026-09-08',
    });

    expect(view!.points.map(p => p.date)).toEqual(['2026-09-08']);
  });
});

describe('averageWeeklyWeights', () => {
  it('collapses each seven-day block to its mean, labelled by that block’s first date', () => {
    const samples = Array.from({ length: 14 }, (_, i) => ({
      date: shiftDate('2026-09-07', i),
      value: i < 7 ? 96 : 94,
    }));

    expect(averageWeeklyWeights(samples)).toEqual([
      { date: '2026-09-07', value: 96 },
      { date: '2026-09-14', value: 94 },
    ]);
  });

  it('buckets by date, so a gap week does not shift later blocks', () => {
    const result = averageWeeklyWeights([
      { date: '2026-09-07', value: 96 },
      // nothing at all in the second week
      { date: '2026-09-21', value: 94 },
    ]);

    expect(result).toEqual([
      { date: '2026-09-07', value: 96 },
      { date: '2026-09-21', value: 94 },
    ]);
  });

  it('sorts before bucketing and leaves the input alone', () => {
    const samples = [
      { date: '2026-09-14', value: 94 },
      { date: '2026-09-07', value: 96 },
    ];

    expect(averageWeeklyWeights(samples)[0]).toEqual({ date: '2026-09-07', value: 96 });
    expect(samples[0]!.date).toBe('2026-09-14');
  });

  it('has nothing to average for an empty series', () => {
    expect(averageWeeklyWeights([])).toEqual([]);
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
