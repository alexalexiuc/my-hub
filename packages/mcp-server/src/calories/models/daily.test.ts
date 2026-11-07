import { describe, expect, it } from 'vitest';
import { isDayGoalMet } from './daily';

const gymDay = { dayTarget: 3300, dayMin: 3200, gymDayBonusApplied: 300 };
const range = { dayTarget: 3000, dayMin: 2900, gymDayBonusApplied: 0 };
const ate = (calories: number) => ({ calories, mealCount: 1 });
const FINISHED = true;
const TODAY = false;

describe('isDayGoalMet', () => {
  it('has no verdict without a target or without anything logged', () => {
    const noTarget = { dayTarget: null, dayMin: null, gymDayBonusApplied: 0 };
    expect(isDayGoalMet('weight_loss', ate(1500), noTarget, null, FINISHED)).toBeNull();
    // History calls an empty past day `not_logged`, not "met".
    expect(isDayGoalMet('weight_loss', { calories: 0, mealCount: 0 }, range, 2600, FINISHED)).toBeNull();
  });

  it('holds a gainer to the day floor, and lets them go over', () => {
    expect(isDayGoalMet('weight_gain', ate(3190), gymDay, 2700, FINISHED)).toBe(false);
    expect(isDayGoalMet('weight_gain', ate(3600), gymDay, 2700, FINISHED)).toBe(true);
  });

  it('holds a gainer without a floor to goal calories plus the bonus, not to the ceiling', () => {
    const noMin = { dayTarget: 3300, dayMin: null, gymDayBonusApplied: 300 };
    expect(isDayGoalMet('weight_gain', ate(3000), noMin, 2700, FINISHED)).toBe(true);
    expect(isDayGoalMet('weight_gain', ate(2900), noMin, 2700, FINISHED)).toBe(false);
  });

  it('wants a finished loss or maintain day inside the range, floor included', () => {
    expect(isDayGoalMet('weight_loss', ate(2950), range, 2600, FINISHED)).toBe(true);
    expect(isDayGoalMet('weight_loss', ate(1200), range, 2600, FINISHED)).toBe(false);
    expect(isDayGoalMet('maintain', ate(3100), range, 3000, FINISHED)).toBe(false);
  });

  it('never fails today for being short, only for what can no longer change', () => {
    // A 400 kcal breakfast has not missed a 2,900 floor yet.
    expect(isDayGoalMet('weight_loss', ate(400), range, 2600, TODAY)).toBe(true);
    expect(isDayGoalMet('weight_loss', ate(3100), range, 2600, TODAY)).toBe(false);
    expect(isDayGoalMet('weight_gain', ate(400), gymDay, 2700, TODAY)).toBeNull();
    expect(isDayGoalMet('weight_gain', ate(3250), gymDay, 2700, TODAY)).toBe(true);
  });
});
