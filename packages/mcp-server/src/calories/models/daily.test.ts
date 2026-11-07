import { describe, expect, it } from 'vitest';
import { isDayGoalMet } from './daily';

const gymDay = { dayTarget: 3300, dayMin: 3200, gymDayBonusApplied: 300 };

describe('isDayGoalMet', () => {
  it('has no verdict without a target', () => {
    expect(
      isDayGoalMet('weight_loss', 1500, { dayTarget: null, dayMin: null, gymDayBonusApplied: 0 }, null),
    ).toBeNull();
  });

  it('holds a gainer to the day floor, and lets them go over', () => {
    expect(isDayGoalMet('weight_gain', 3190, gymDay, 2700)).toBe(false);
    expect(isDayGoalMet('weight_gain', 3600, gymDay, 2700)).toBe(true);
  });

  it('holds a gainer without a floor to goal calories plus the bonus, not to the ceiling', () => {
    const noMin = { dayTarget: 3300, dayMin: null, gymDayBonusApplied: 300 };
    // 2,900 is short of the 3,300 ceiling but past 2,700 + 300.
    expect(isDayGoalMet('weight_gain', 3000, noMin, 2700)).toBe(true);
    expect(isDayGoalMet('weight_gain', 2900, noMin, 2700)).toBe(false);
  });

  it('wants loss and maintain days inside the range, floor included', () => {
    const range = { dayTarget: 3000, dayMin: 2900, gymDayBonusApplied: 0 };
    expect(isDayGoalMet('weight_loss', 2950, range, 2600)).toBe(true);
    expect(isDayGoalMet('weight_loss', 1200, range, 2600)).toBe(false);
    expect(isDayGoalMet('maintain', 3100, range, 3000)).toBe(false);
  });
});
