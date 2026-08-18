import { describe, expect, it } from 'vitest';
import {
  calculateBMR,
  calculateCalorieTargets,
  calculateMacroKcal,
  dayCalorieTargets,
  dayTargetKcal,
  hasDuplicateMealSlot,
  latestWeightKg,
  matchesPlannedMeal,
  mealOrder,
  profileToTargets,
} from './calories';
import { MealTypesValues } from '../constants';

describe('calculateBMR', () => {
  // Mifflin-St Jeor: 10w + 6.25h − 5a, +5 male / −161 female.
  it('applies the male constant', () => {
    expect(calculateBMR(34, 'male', 178, 78)).toBe(10 * 78 + 6.25 * 178 - 5 * 34 + 5);
  });

  it('applies the female constant', () => {
    expect(calculateBMR(34, 'female', 178, 78)).toBe(10 * 78 + 6.25 * 178 - 5 * 34 - 161);
  });

  it('returns null when any input is missing, rather than guessing', () => {
    expect(calculateBMR(null, 'male', 178, 78)).toBeNull();
    expect(calculateBMR(34, null, 178, 78)).toBeNull();
    expect(calculateBMR(34, 'male', null, 78)).toBeNull();
    expect(calculateBMR(34, 'male', 178, null)).toBeNull();
  });
});

describe('calculateCalorieTargets', () => {
  const base = {
    age: 34,
    sex: 'male' as const,
    heightCm: 178,
    weightKg: 78,
    activityLevel: 'sedentary' as const,
    goalType: null,
    goalWeeklyRateKg: null,
    goalMinCalories: null,
    goalMaxCalories: null,
  };
  // Derived, not hardcoded: BMR is 1727.5 here and the multiplier is applied before rounding, so
  // a hand-written round number would be testing a different calculation than the one shipped.
  const BMR = calculateBMR(base.age, base.sex, base.heightCm, base.weightKg)!;
  const TDEE = Math.round(BMR * 1.2);

  it('returns TDEE as the goal when no goal is set', () => {
    const { tdee, goalCalories } = calculateCalorieTargets(base);
    expect(tdee).toBe(TDEE);
    expect(goalCalories).toBe(TDEE);
  });

  it('subtracts the weekly rate as a daily deficit for weight loss', () => {
    // 0.5 kg/week → 7700 × 0.5 / 7 = 550 kcal/day.
    const { goalCalories } = calculateCalorieTargets({
      ...base,
      goalType: 'weight_loss',
      goalWeeklyRateKg: 0.5,
    });
    expect(goalCalories).toBe(TDEE - 550);
  });

  it('adds it as a surplus for weight gain', () => {
    const { goalCalories } = calculateCalorieTargets({ ...base, goalType: 'weight_gain', goalWeeklyRateKg: 0.5 });
    expect(goalCalories).toBe(TDEE + 550);
  });

  it('never lets a loss goal fall below the safe floor', () => {
    // A 2 kg/week rate is a 2200 kcal/day deficit — more than the whole TDEE.
    const { goalCalories } = calculateCalorieTargets({ ...base, goalType: 'weight_loss', goalWeeklyRateKg: 2 });
    expect(goalCalories).toBe(1200);
  });

  it('lets an explicit ceiling override the derived goal', () => {
    const { goalCalories, maxCalories } = calculateCalorieTargets({ ...base, goalMaxCalories: 1900 });
    expect(goalCalories).toBe(TDEE);
    expect(maxCalories).toBe(1900);
  });

  it('defaults the ceiling to the goal when none is set', () => {
    expect(calculateCalorieTargets(base).maxCalories).toBe(TDEE);
  });

  it('returns null targets but keeps explicit overrides when BMR cannot be computed', () => {
    const targets = calculateCalorieTargets({ ...base, weightKg: null, goalMinCalories: 1500, goalMaxCalories: 2200 });
    expect(targets.tdee).toBeNull();
    expect(targets.goalCalories).toBeNull();
    expect(targets.minCalories).toBe(1500);
    expect(targets.maxCalories).toBe(2200);
  });

  it('falls back to the sedentary multiplier when activity is unset', () => {
    expect(calculateCalorieTargets({ ...base, activityLevel: null }).tdee).toBe(TDEE);
  });

  it('scales with activity level', () => {
    expect(calculateCalorieTargets({ ...base, activityLevel: 'very_active' }).tdee).toBe(Math.round(BMR * 1.725));
  });
});

describe('profileToTargets', () => {
  it('maps a profile plus the latest weight onto the same result', () => {
    const profile = { age: 34, sex: 'male' as const, heightCm: 178, activityLevel: 'sedentary' as const };
    expect(profileToTargets(profile, 78)).toEqual(
      calculateCalorieTargets({
        ...profile,
        weightKg: 78,
        goalType: null,
        goalWeeklyRateKg: null,
        goalMinCalories: null,
        goalMaxCalories: null,
      }),
    );
  });

  it('treats a missing profile as all-null rather than throwing', () => {
    expect(profileToTargets(null, 78)).toEqual({
      tdee: null,
      goalCalories: null,
      minCalories: null,
      maxCalories: null,
    });
  });
});

describe('calculateMacroKcal', () => {
  it('counts protein and carbs at 4 and fat at 9', () => {
    expect(calculateMacroKcal(40, 60, 12)).toBe(40 * 4 + 60 * 4 + 12 * 9);
  });
});

describe('dayTargetKcal', () => {
  it('adds the bonus only on a training day', () => {
    expect(dayTargetKcal(2000, true, 300)).toBe(2300);
    expect(dayTargetKcal(2000, false, 300)).toBe(2000);
  });
});

describe('hasDuplicateMealSlot', () => {
  it('accepts the same meal type on different days', () => {
    expect(
      hasDuplicateMealSlot([
        { dayOfWeek: 0, mealType: 'breakfast' },
        { dayOfWeek: 1, mealType: 'breakfast' },
      ]),
    ).toBe(false);
  });

  it('rejects the same slot twice', () => {
    expect(
      hasDuplicateMealSlot([
        { dayOfWeek: 0, mealType: 'breakfast' },
        { dayOfWeek: 0, mealType: 'breakfast' },
      ]),
    ).toBe(true);
  });

  it('treats an empty list as free of duplicates', () => {
    expect(hasDuplicateMealSlot([])).toBe(false);
  });
});

describe('dayCalorieTargets', () => {
  // Enough profile to produce a real target: 34y male, 178cm, 78kg, sedentary multiplier.
  const profile = {
    age: 34,
    sex: 'male' as const,
    heightCm: 178,
    activityLevel: 'sedentary' as const,
    goalType: null,
    goalWeeklyRateKg: null,
    goalMinCalories: 1800,
    goalMaxCalories: 2000,
    gymDays: [0, 4], // Monday and Friday
    gymDayCalorieBonus: 300,
  };

  it('adds the bonus to both ceiling and floor on a training day', () => {
    // 2026-08-07 is a Friday.
    expect(dayCalorieTargets(profile, 78, '2026-08-07')).toEqual({
      target: 2300,
      min: 2100,
      isGymDay: true,
      gymDayBonus: 300,
    });
  });

  it('leaves both untouched on a rest day', () => {
    // 2026-08-08 is a Saturday.
    expect(dayCalorieTargets(profile, 78, '2026-08-08')).toEqual({
      target: 2000,
      min: 1800,
      isGymDay: false,
      gymDayBonus: 300,
    });
  });

  it('falls back to the default bonus when the profile sets none', () => {
    const { gymDayBonus, target } = dayCalorieTargets({ ...profile, gymDayCalorieBonus: null }, 78, '2026-08-07');
    expect(gymDayBonus).toBe(300);
    expect(target).toBe(2300);
  });

  it('returns null targets when the profile cannot produce one', () => {
    const { target, min } = dayCalorieTargets({ gymDays: [0] }, null, '2026-08-07');
    expect(target).toBeNull();
    expect(min).toBeNull();
  });

  it('treats a missing profile as a rest day with no targets', () => {
    expect(dayCalorieTargets(null, 78, '2026-08-07')).toEqual({
      target: null,
      min: null,
      isGymDay: false,
      gymDayBonus: 300,
    });
  });
});

describe('latestWeightKg', () => {
  it('picks the weight entry out of a mixed measurement list', () => {
    expect(
      latestWeightKg([
        { typeKey: 'waist', value: 84 },
        { typeKey: 'weight', value: 77.5 },
      ]),
    ).toBe(77.5);
  });

  it('returns null when no weight has been recorded', () => {
    expect(latestWeightKg([{ typeKey: 'waist', value: 84 }])).toBeNull();
  });
});

describe('mealOrder', () => {
  it('puts the pre/post pair before breakfast for morning training', () => {
    expect(mealOrder('morning')).toEqual([
      'pre_workout',
      'post_workout',
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'other',
    ]);
  });

  it('puts the pre/post pair before lunch for midday training', () => {
    expect(mealOrder('midday')).toEqual([
      'breakfast',
      'pre_workout',
      'post_workout',
      'lunch',
      'dinner',
      'snack',
      'other',
    ]);
  });

  it('puts the pre/post pair before dinner for evening training', () => {
    expect(mealOrder('evening')).toEqual([
      'breakfast',
      'lunch',
      'pre_workout',
      'post_workout',
      'dinner',
      'snack',
      'other',
    ]);
  });

  it('keeps the pair at the tail when no gym time is set', () => {
    expect(mealOrder(null)).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout', 'other']);
  });

  it('returns every meal type exactly once for every band', () => {
    for (const gymTime of [null, 'morning', 'midday', 'evening'] as const) {
      const order = mealOrder(gymTime);
      expect(order).toHaveLength(MealTypesValues.length);
      expect(new Set(order)).toEqual(new Set(MealTypesValues));
    }
  });

  it('keeps snack and other at the tail for every band', () => {
    // Only the anchored orders — the fallback deliberately parks the pre/post pair at the tail,
    // where there is no session to anchor them to.
    for (const gymTime of ['morning', 'midday', 'evening'] as const) {
      expect(mealOrder(gymTime).slice(-2)).toEqual(['snack', 'other']);
    }
  });

  it('keeps the pre and post slots adjacent in every anchored band', () => {
    for (const gymTime of ['morning', 'midday', 'evening'] as const) {
      const order = mealOrder(gymTime);
      expect(order.indexOf('post_workout') - order.indexOf('pre_workout')).toBe(1);
    }
  });
});

describe('matchesPlannedMeal', () => {
  it('matches near-identical wording of the same dish, diacritics and small edits aside', () => {
    expect(
      matchesPlannedMeal(
        'Paste Barilla cu carne toca, sos de roșii și salată castraveți/ardei',
        'Paste Barilla cu carne tocată, sos de roșii și salată mare de castraveți/ardei',
      ),
    ).toBe(true);
  });

  it('matches an exact repeat of the description', () => {
    expect(matchesPlannedMeal('Grilled chicken with rice', 'Grilled chicken with rice')).toBe(true);
  });

  it('does not match a side item logged on its own against the full planned dish', () => {
    expect(matchesPlannedMeal('Ketchup, 20g', 'Paste Barilla cu carne tocată, sos de roșii și salată mare')).toBe(
      false,
    );
  });

  it('does not match a single shared connector word between otherwise unrelated dishes', () => {
    expect(matchesPlannedMeal('Salad with fries', 'Ketchup with fries')).toBe(false);
  });

  it('does not match a single ingredient logged alone against a multi-ingredient planned dish', () => {
    expect(matchesPlannedMeal('rice', 'Grilled chicken with rice')).toBe(false);
  });

  it('does not match unrelated dishes', () => {
    expect(matchesPlannedMeal('Greek yogurt with berries', 'Grilled salmon with asparagus')).toBe(false);
  });

  it('returns false when either description is empty or only stopwords', () => {
    expect(matchesPlannedMeal('', 'Grilled chicken with rice')).toBe(false);
    expect(matchesPlannedMeal('with the a', 'Grilled chicken with rice')).toBe(false);
  });
});
