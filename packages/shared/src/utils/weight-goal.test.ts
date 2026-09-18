import { describe, expect, it } from 'vitest';
import {
  buildWeightTrend,
  dailyGoalDeltaKg,
  daysBetweenDateStr,
  goalJourney,
  isAheadOfGoal,
  projectGoalDate,
  projectedWeightOn,
  resolveGoalAnchor,
  trendOn,
  trendRateKgPerWeek,
  type GoalAnchor,
} from './weight-goal';

describe('dailyGoalDeltaKg', () => {
  it('spreads a weekly loss rate over seven days, as a negative', () => {
    expect(dailyGoalDeltaKg('weight_loss', 0.7)).toBeCloseTo(-0.1);
  });

  it('spreads a weekly gain rate as a positive', () => {
    expect(dailyGoalDeltaKg('weight_gain', 0.7)).toBeCloseTo(0.1);
  });

  it('is flat for a maintain goal, with or without a rate', () => {
    expect(dailyGoalDeltaKg('maintain', null)).toBe(0);
    expect(dailyGoalDeltaKg('maintain', 0.5)).toBe(0);
  });

  it('has no answer when the rate is missing, zero or negative', () => {
    expect(dailyGoalDeltaKg('weight_loss', null)).toBeNull();
    expect(dailyGoalDeltaKg('weight_loss', 0)).toBeNull();
    // A negative rate would describe a loss goal that gains — refuse rather than invert it.
    expect(dailyGoalDeltaKg('weight_loss', -0.5)).toBeNull();
  });

  it('has no answer for an unset or unknown goal', () => {
    expect(dailyGoalDeltaKg(null, 0.5)).toBeNull();
    expect(dailyGoalDeltaKg('bulk', 0.5)).toBeNull();
  });
});

describe('daysBetweenDateStr', () => {
  it('counts whole days forward and back', () => {
    expect(daysBetweenDateStr('2026-09-01', '2026-09-08')).toBe(7);
    expect(daysBetweenDateStr('2026-09-08', '2026-09-01')).toBe(-7);
    expect(daysBetweenDateStr('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('crosses a month and a leap day without drifting', () => {
    expect(daysBetweenDateStr('2026-08-30', '2026-09-02')).toBe(3);
    expect(daysBetweenDateStr('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('resolveGoalAnchor', () => {
  const samples = [
    { date: '2026-09-10', value: 96 },
    { date: '2026-08-26', value: 97.6 },
    { date: '2026-09-01', value: 97 },
  ];

  it('prefers the baseline stored on the profile', () => {
    const anchor = resolveGoalAnchor({ goalStartDate: '2026-09-07', goalStartWeightKg: 98 }, samples);
    expect(anchor).toEqual({ date: '2026-09-07', weightKg: 98, source: 'profile' });
  });

  it('falls back to the oldest weigh-in, flagged as inferred', () => {
    const anchor = resolveGoalAnchor(null, samples);
    expect(anchor).toEqual({ date: '2026-08-26', weightKg: 97.6, source: 'inferred' });
  });

  it('needs both stored fields before it trusts the profile', () => {
    expect(resolveGoalAnchor({ goalStartDate: '2026-09-07', goalStartWeightKg: null }, samples)?.source).toBe(
      'inferred',
    );
    expect(resolveGoalAnchor({ goalStartDate: null, goalStartWeightKg: 98 }, samples)?.source).toBe('inferred');
  });

  it('accepts a stored baseline of zero rather than treating it as absent', () => {
    // Not a realistic weight, but `!weight` would silently reject it — the guard is a type check.
    expect(resolveGoalAnchor({ goalStartDate: '2026-09-07', goalStartWeightKg: 0 }, samples)?.source).toBe('profile');
  });

  it('has no anchor without a baseline or any weigh-in', () => {
    expect(resolveGoalAnchor(null, [])).toBeNull();
  });
});

describe('projectedWeightOn', () => {
  const anchor: GoalAnchor = { date: '2026-09-07', weightKg: 98, source: 'profile' };
  const dailyDelta = dailyGoalDeltaKg('weight_loss', 1)!;

  it('moves the anchor by the daily delta for each elapsed day', () => {
    expect(projectedWeightOn(anchor, dailyDelta, '2026-09-07')).toBeCloseTo(98);
    expect(projectedWeightOn(anchor, dailyDelta, '2026-09-14')).toBeCloseTo(97);
    expect(projectedWeightOn(anchor, dailyDelta, '2026-09-21')).toBeCloseTo(96);
  });

  /**
   * The defect this whole anchor exists to fix: a week that ends over target used to become the
   * next week's baseline, so two weeks of a 1 kg/week goal could still target only 1 kg down.
   */
  it('keeps the goal cumulative across weeks regardless of what the scale did in between', () => {
    const startedAt90: GoalAnchor = { date: '2026-09-07', weightKg: 90, source: 'profile' };
    // A hard weekend put week one's close at 91 rather than the 89 it aimed for.
    expect(projectedWeightOn(startedAt90, dailyDelta, '2026-09-14')).toBeCloseTo(89);
    // Week two still targets 88, not 90 — the miss is carried, not forgiven.
    expect(projectedWeightOn(startedAt90, dailyDelta, '2026-09-21')).toBeCloseTo(88);
  });

  it('extends backwards before the anchor, so a wider window still shows the line', () => {
    expect(projectedWeightOn(anchor, dailyDelta, '2026-08-31')).toBeCloseTo(99);
  });

  it('is flat for a maintain goal', () => {
    expect(projectedWeightOn(anchor, 0, '2026-12-25')).toBe(98);
  });
});

describe('buildWeightTrend', () => {
  it('starts on the first reading and lags the ones after it', () => {
    const trend = buildWeightTrend(
      [
        { date: '2026-09-01', value: 100 },
        { date: '2026-09-02', value: 110 },
      ],
      0.1,
    );
    expect(trend[0]!.trend).toBe(100);
    expect(trend[1]!.trend).toBeCloseTo(101);
    // The raw reading is kept alongside, so a chart can still plot what the scale said.
    expect(trend[1]!.value).toBe(110);
  });

  it('sorts oldest-first, so newest-first API rows smooth in the right direction', () => {
    const trend = buildWeightTrend(
      [
        { date: '2026-09-03', value: 96 },
        { date: '2026-09-01', value: 98 },
        { date: '2026-09-02', value: 97 },
      ],
      0.5,
    );
    expect(trend.map(p => p.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(trend[0]!.trend).toBe(98);
    expect(trend[1]!.trend).toBeCloseTo(97.5);
    expect(trend[2]!.trend).toBeCloseTo(96.75);
  });

  /**
   * The reason the card compares trend rather than raw readings: a single water-weight spike is
   * the same order of magnitude as a whole week of goal progress.
   */
  it('absorbs a one-day water spike instead of letting it swing the comparison', () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      value: 96,
    }));
    const spiked = [...flat, { date: '2026-09-11', value: 97.5 }];

    const trend = buildWeightTrend(spiked)!;
    const last = trend.at(-1)!;
    expect(last.value).toBe(97.5);
    // 1.5 kg on the scale moves the trend by 0.15 kg.
    expect(last.trend).toBeCloseTo(96.15, 2);
  });

  it('returns nothing for no samples and a bare point for one', () => {
    expect(buildWeightTrend([])).toEqual([]);
    expect(buildWeightTrend([{ date: '2026-09-01', value: 96 }])).toEqual([
      { date: '2026-09-01', value: 96, trend: 96 },
    ]);
  });

  it('leaves the input array untouched', () => {
    const samples = [
      { date: '2026-09-03', value: 96 },
      { date: '2026-09-01', value: 98 },
    ];
    buildWeightTrend(samples);
    expect(samples.map(s => s.date)).toEqual(['2026-09-03', '2026-09-01']);
  });
});

describe('trendRateKgPerWeek', () => {
  it('reads a steady decline as a negative weekly rate', () => {
    // 0.1 kg/day down, sampled daily for a fortnight → 0.7 kg/week off.
    const samples = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      value: 100 - i * 0.1,
    }));
    // alpha 1 makes the trend follow the readings exactly, isolating the slope maths.
    expect(trendRateKgPerWeek(buildWeightTrend(samples, 1))).toBeCloseTo(-0.7);
  });

  it('reads a steady climb as a positive rate, and a flat series as zero', () => {
    const rising = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      value: 80 + i * 0.05,
    }));
    expect(trendRateKgPerWeek(buildWeightTrend(rising, 1))).toBeCloseTo(0.35);

    const flat = rising.map(s => ({ ...s, value: 80 }));
    expect(trendRateKgPerWeek(buildWeightTrend(flat, 1))).toBeCloseTo(0);
  });

  it('spans gaps by date rather than by sample count', () => {
    // Two weigh-ins a fortnight apart, 2 kg down: 1 kg/week, not 2.
    const trend = buildWeightTrend(
      [
        { date: '2026-09-01', value: 98 },
        { date: '2026-09-15', value: 96 },
      ],
      1,
    );
    expect(trendRateKgPerWeek(trend)).toBeCloseTo(-1);
  });

  it('has no slope to report below two points or when every point shares a date', () => {
    expect(trendRateKgPerWeek([])).toBeNull();
    expect(trendRateKgPerWeek(buildWeightTrend([{ date: '2026-09-01', value: 96 }]))).toBeNull();
    expect(
      trendRateKgPerWeek([
        { date: '2026-09-01', value: 96, trend: 96 },
        { date: '2026-09-01', value: 97, trend: 97 },
      ]),
    ).toBeNull();
  });
});

describe('trendOn', () => {
  const points = buildWeightTrend(
    [
      { date: '2026-09-01', value: 98 },
      { date: '2026-09-08', value: 96 },
      { date: '2026-09-15', value: 95 },
    ],
    1,
  );

  it('returns the value on an exact date', () => {
    expect(trendOn(points, '2026-09-08')).toBe(96);
  });

  it('falls back to the most recent earlier point, so a day with no weigh-in still answers', () => {
    expect(trendOn(points, '2026-09-11')).toBe(96);
  });

  it('has nothing before the first point', () => {
    expect(trendOn(points, '2026-08-31')).toBeNull();
    expect(trendOn([], '2026-09-08')).toBeNull();
  });

  it('does not run past the end', () => {
    expect(trendOn(points, '2027-01-01')).toBe(95);
  });
});

describe('goalJourney', () => {
  const anchor: GoalAnchor = { date: '2026-07-01', weightKg: 98, source: 'profile' };

  it('measures the distance covered towards a loss target', () => {
    // 98 → 88 is a 10 kg journey; at 93 the halfway point.
    expect(goalJourney(anchor, 88, 93, -1)).toEqual({
      changedKg: -5,
      totalKg: -10,
      remainingKg: -5,
      pct: 50,
    });
  });

  it('works the same way for a gain target', () => {
    const start: GoalAnchor = { date: '2026-07-01', weightKg: 60, source: 'profile' };
    const journey = goalJourney(start, 70, 62.5, 1)!;
    expect(journey.pct).toBeCloseTo(25);
    expect(journey.remainingKg).toBeCloseTo(7.5);
  });

  it('clamps rather than reporting negative progress when the weight moved the wrong way', () => {
    expect(goalJourney(anchor, 88, 99, -1)!.pct).toBe(0);
  });

  it('clamps at 100 once the target is passed, instead of reporting more than the whole journey', () => {
    expect(goalJourney(anchor, 88, 86, -1)!.pct).toBe(100);
    // The remaining figure is still signed and honest about the overshoot.
    expect(goalJourney(anchor, 88, 86, -1)!.remainingKg).toBeCloseTo(2);
  });

  it('refuses a target on the wrong side of the baseline for the goal direction', () => {
    // A loss goal aiming above the starting weight is a typo, not a journey.
    expect(goalJourney(anchor, 105, 97, -1)).toBeNull();
    expect(goalJourney(anchor, 88, 93, 1)).toBeNull();
  });

  it('accepts either direction when no direction is given', () => {
    expect(goalJourney(anchor, 105, 100)).not.toBeNull();
    expect(goalJourney(anchor, 88, 93)).not.toBeNull();
  });

  it('has no journey when the target is the baseline', () => {
    expect(goalJourney(anchor, 98, 97, -1)).toBeNull();
  });
});

describe('projectGoalDate', () => {
  it('divides the remaining distance by the rate', () => {
    // 3.5 kg to go at 0.5 kg/week is 7 weeks — 49 days.
    expect(projectGoalDate(91.5, 88, -0.5, '2026-09-18')).toBe('2026-11-06');
  });

  it('reads the same for a gain goal', () => {
    expect(projectGoalDate(60, 62, 0.5, '2026-09-18')).toBe('2026-10-16');
  });

  it('returns today when the target is already reached', () => {
    expect(projectGoalDate(88, 88, -0.5, '2026-09-18')).toBe('2026-09-18');
  });

  it('has no answer when the rate is missing, zero, or points away from the target', () => {
    expect(projectGoalDate(91.5, 88, null, '2026-09-18')).toBeNull();
    expect(projectGoalDate(91.5, 88, 0, '2026-09-18')).toBeNull();
    // Gaining while trying to lose never arrives.
    expect(projectGoalDate(91.5, 88, 0.3, '2026-09-18')).toBeNull();
  });

  it('declines to forecast more than ten years out', () => {
    // 3.5 kg at 0.005 kg/week is 700 weeks — arithmetic, not a prediction.
    expect(projectGoalDate(91.5, 88, -0.005, '2026-09-18')).toBeNull();
  });
});

describe('isAheadOfGoal', () => {
  it('counts below the line as ahead for loss and behind for gain', () => {
    expect(isAheadOfGoal('weight_loss', -0.4)).toBe(true);
    expect(isAheadOfGoal('weight_loss', 0.4)).toBe(false);
    expect(isAheadOfGoal('weight_gain', 0.4)).toBe(true);
    expect(isAheadOfGoal('weight_gain', -0.4)).toBe(false);
  });

  it('has no good side for maintain or an unset goal', () => {
    expect(isAheadOfGoal('maintain', 0.4)).toBeNull();
    expect(isAheadOfGoal(null, 0.4)).toBeNull();
  });
});
