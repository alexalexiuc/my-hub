// ---------------------------------------------------------------------------
// Calorie / TDEE calculation utilities
// ---------------------------------------------------------------------------

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

/** Minimum safe daily calories used as a floor for weight-loss goals. */
const MIN_SAFE_CALORIES = 1200;

/**
 * Calorie targets derived from the user's profile and goal settings.
 *
 * - `tdee`         – raw TDEE (BMR × activity multiplier), no goal adjustment
 * - `goalCalories` – primary daily target after applying goal offset
 * - `minCalories`  – explicit floor (from goalMinCalories override)
 * - `maxCalories`  – explicit ceiling (from goalMaxCalories override); for
 *                    weight-loss goals this equals goalCalories when no
 *                    override is set, acting as the "do not exceed" cap
 */
export interface CalorieTargets {
  tdee: number | null;
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
}

export interface CalorieTargetParams {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goalType: string | null;         // 'weight_loss' | 'weight_gain' | 'maintain'
  goalWeeklyRateKg: number | null; // kg/week
  goalMinCalories: number | null;
  goalMaxCalories: number | null;
}

/**
 * Calculate BMR using the Mifflin-St Jeor equation.
 * Returns null if any required input is missing.
 */
export function calculateBMR(
  age: number | null,
  sex: string | null,
  heightCm: number | null,
  weightKg: number | null,
): number | null {
  if (!age || !sex || !heightCm || !weightKg) return null;
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  if (sex === 'female') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  return null;
}

/**
 * Derive all calorie targets from profile demographics and goal settings.
 *
 * Goal → goalCalories logic:
 *   weight_loss : TDEE − (rateKg × 7700 / 7)  [floored at MIN_SAFE_CALORIES]
 *   weight_gain : TDEE + (rateKg × 7700 / 7)
 *   maintain    : TDEE
 *   no goal     : TDEE
 *
 * Overrides:
 *   goalMaxCalories replaces goalCalories as the returned maxCalories.
 *   goalMinCalories is passed through as minCalories.
 */
export function calculateCalorieTargets(params: CalorieTargetParams): CalorieTargets {
  const {
    age, sex, heightCm, weightKg, activityLevel,
    goalType, goalWeeklyRateKg,
    goalMinCalories, goalMaxCalories,
  } = params;

  const bmr = calculateBMR(age, sex, heightCm, weightKg);
  if (bmr === null) {
    return {
      tdee: null,
      goalCalories: null,
      minCalories: goalMinCalories ?? null,
      maxCalories: goalMaxCalories ?? null,
    };
  }

  const multiplier = activityLevel ? (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2) : 1.2;
  const tdee = Math.round(bmr * multiplier);

  let goalCalories: number = tdee;
  if (goalType === 'weight_loss' && goalWeeklyRateKg) {
    const dailyDeficit = Math.round((goalWeeklyRateKg * 7700) / 7);
    goalCalories = Math.max(tdee - dailyDeficit, MIN_SAFE_CALORIES);
  } else if (goalType === 'weight_gain' && goalWeeklyRateKg) {
    const dailySurplus = Math.round((goalWeeklyRateKg * 7700) / 7);
    goalCalories = tdee + dailySurplus;
  }

  // Explicit overrides take precedence
  const maxCalories = goalMaxCalories ?? goalCalories;
  const minCalories = goalMinCalories ?? null;

  return { tdee, goalCalories, minCalories, maxCalories };
}
