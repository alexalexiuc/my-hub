import { describe, expect, it } from 'vitest';
import { energyGapSummary, fmtGoalRate, fmtSignedWeight } from './report-format';

const MINUS = '−';

describe('fmtSignedWeight', () => {
  it('keeps quarter-kilo precision and trims trailing zeros', () => {
    expect(fmtSignedWeight(0.25)).toBe('+0.25');
    expect(fmtSignedWeight(-0.5)).toBe(`${MINUS}0.5`);
    expect(fmtSignedWeight(2)).toBe('+2');
  });
});

describe('fmtGoalRate', () => {
  it('prints a set rate with its sign and unit', () => {
    expect(fmtGoalRate(0.25, 1, 'kg/week')).toBe('+0.25 kg/week');
    expect(fmtGoalRate(-0.5, -1, 'kg')).toBe(`${MINUS}0.5 kg`);
  });

  it('says "hold steady" for a maintain goal', () => {
    expect(fmtGoalRate(0, 0, 'kg/week')).toBe('hold steady');
  });

  it('says "not set" for a gain or loss goal with no rate, rather than "hold steady"', () => {
    expect(fmtGoalRate(0, 1, 'kg/week')).toBe('not set');
    expect(fmtGoalRate(0, -1, 'kg')).toBe('not set');
  });
});

describe('energyGapSummary', () => {
  it('names a surplus and colours it green on a gaining goal, even when no rate is set', () => {
    // The reported case: weight_gain with no rate, a 3,200 ceiling against a 2,670 TDEE.
    const summary = energyGapSummary(3200, 2670, 1);
    expect(summary.label).toBe('Daily surplus');
    expect(summary.value).toBe('+530');
    expect(summary.color).toBe('#3db87a');
  });

  it('colours the same surplus red on a losing goal', () => {
    expect(energyGapSummary(3200, 2670, -1).color).toBe('#e05a5a');
  });

  it('on a maintain goal, is green only within 100 kcal of maintenance', () => {
    expect(energyGapSummary(2720, 2670, 0).color).toBe('#3db87a');
    expect(energyGapSummary(3200, 2670, 0).color).toBe('#e05a5a');
  });
});
