/**
 * Calorie / TDEE calculation utilities
 * - calculateBMR(age, sex, heightCm, weightKg) — Basal Metabolic Rate via Mifflin-St Jeor; returns null if inputs missing
 * - calculateCalorieTargets(params) — derives tdee, goalCalories, minCalories, maxCalories from profile + goal settings
 * - profileToTargets(profile, weightKg?) — maps a (possibly partial/null) calorie profile + latest weight to calculateCalorieTargets
 * - hasDuplicateMealSlot(meals) — true if any (dayOfWeek, mealType) slot appears more than once in a weekly-menu meal list
 * - dayTargetKcal(baseTarget, isGymDay, gymDayBonus) — one day's calorie target, including the gym-day bonus
 * - dayCalorieTargets(profile, weightKg, date) — the whole per-day rule: ceiling, floor, gym-day flag and bonus
 * - latestWeightKg(measurements) — most recent weight value from a latest-per-type measurement list
 * - mealOrder(gymTime) — the order a day's meal slots are displayed in, with pre/post-workout placed around the training session
 * - matchesPlannedMeal(loggedDescription, plannedDescription) — true when a freely-logged meal is almost certainly the same dish as a planned menu meal (Jaccard word-overlap over stopword-stripped, normalized text)
 * - ActivityLevelMultipliers — Record<ActivityLevel, number> mapping activity levels to TDEE multipliers
 * Types: CalorieTargets, CalorieTargetParams, CalorieProfileLike
 */

// ---------------------------------------------------------------------------
// Calorie / TDEE calculation utilities
// ---------------------------------------------------------------------------

import {
  ActivityLevel,
  ActivityLevels,
  Sex,
  GoalType,
  Sexes,
  GoalTypes,
  GymTime,
  GymTimes,
  MealType,
  MealTypes,
  MeasurementTypes,
  DEFAULT_GYM_DAY_CALORIE_BONUS,
} from '../constants';
import { dayOfWeekMon0 } from './dates';

export const ActivityLevelMultipliers: Record<ActivityLevel, number> = {
  [ActivityLevels.Sedentary]: 1.2,
  [ActivityLevels.LightlyActive]: 1.375,
  [ActivityLevels.ModeratelyActive]: 1.55,
  [ActivityLevels.VeryActive]: 1.725,
  [ActivityLevels.ExtraActive]: 1.9,
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
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  goalType: GoalType | null; // 'weight_loss' | 'weight_gain' | 'maintain'
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
  sex: Sex | null,
  heightCm: number | null,
  weightKg: number | null,
): number | null {
  if (!age || !sex || !heightCm || !weightKg) return null;
  if (sex === Sexes.Male) {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  if (sex === Sexes.Female) {
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
  const { age, sex, heightCm, weightKg, activityLevel, goalType, goalWeeklyRateKg, goalMinCalories, goalMaxCalories } =
    params;

  const bmr = calculateBMR(age, sex, heightCm, weightKg);
  if (bmr === null) {
    return {
      tdee: null,
      goalCalories: null,
      minCalories: goalMinCalories ?? null,
      maxCalories: goalMaxCalories ?? null,
    };
  }

  const multiplier = activityLevel ? (ActivityLevelMultipliers[activityLevel as ActivityLevel] ?? 1.2) : 1.2;
  const tdee = Math.round(bmr * multiplier);

  let goalCalories: number = tdee;
  if (goalType === GoalTypes.WeightLoss && goalWeeklyRateKg) {
    const dailyDeficit = Math.round((goalWeeklyRateKg * 7700) / 7);
    goalCalories = Math.max(tdee - dailyDeficit, MIN_SAFE_CALORIES);
  } else if (goalType === GoalTypes.WeightGain && goalWeeklyRateKg) {
    const dailySurplus = Math.round((goalWeeklyRateKg * 7700) / 7);
    goalCalories = tdee + dailySurplus;
  }

  // Explicit overrides take precedence
  const maxCalories = goalMaxCalories ?? goalCalories;
  const minCalories = goalMinCalories ?? null;

  return { tdee, goalCalories, minCalories, maxCalories };
}

/**
 * Any object carrying the profile fields needed for target calculation —
 * a DB `CalorieProfile` row, an API payload, or a partial client-side shape.
 * Every field may be absent or null.
 */
export type CalorieProfileLike = Partial<Omit<CalorieTargetParams, 'weightKg'>>;

/**
 * Maps a (possibly partial or missing) calorie profile plus the latest weight
 * measurement to `calculateCalorieTargets`. Single home for the profile→params
 * field mapping so call sites don't each repeat the nine `?? null` lines.
 */
export function profileToTargets(
  profile: CalorieProfileLike | null | undefined,
  weightKg?: number | null,
): CalorieTargets {
  return calculateCalorieTargets({
    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    weightKg: weightKg ?? null,
    activityLevel: profile?.activityLevel ?? null,
    goalType: profile?.goalType ?? null,
    goalWeeklyRateKg: profile?.goalWeeklyRateKg ?? null,
    goalMinCalories: profile?.goalMinCalories ?? null,
    goalMaxCalories: profile?.goalMaxCalories ?? null,
  });
}

/**
 * Converts macro grams to total kilocalories.
 * Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g.
 */
export function calculateMacroKcal(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

/**
 * True if `meals` contains more than one entry for the same (dayOfWeek, mealType) slot.
 * Single source of truth for the weekly-menu "one meal per slot" rule — used by the Hub
 * create-menu validation, CreateMenuModal's live duplicate hint, and the MCP
 * create-weekly-menu tool, so every write path agrees on what counts as a duplicate.
 */
export function hasDuplicateMealSlot(meals: { dayOfWeek: number; mealType: string }[]): boolean {
  return new Set(meals.map(m => `${m.dayOfWeek}:${m.mealType}`)).size !== meals.length;
}

/**
 * The calorie target for a single day: the base daily target, plus the gym-day bonus when the
 * user trains that day. Every surface that shows a day's target has to apply this — a day shown
 * as over target on one screen and on track on another is the same day counted two ways.
 */
export function dayTargetKcal(baseTarget: number, isGymDay: boolean, gymDayBonus: number): number {
  return isGymDay ? baseTarget + gymDayBonus : baseTarget;
}

/** A calorie profile plus the training fields a day's target depends on. Every field may be absent. */
export type DayTargetProfileLike = CalorieProfileLike & {
  gymDays?: number[] | null;
  gymDayCalorieBonus?: number | null;
};

export interface DayCalorieTargets {
  /** Ceiling for the day, bonus included. Null when the profile can't produce a target. */
  target: number | null;
  /** Floor for the day, bonus included. Null when the profile sets no minimum. */
  min: number | null;
  isGymDay: boolean;
  gymDayBonus: number;
}

/**
 * Everything a screen needs to judge one day's intake: the ceiling, the floor, and whether the
 * bonus applied.
 *
 * This is the whole rule, not just the addition — which base target counts, how the training day
 * is decided, and what the bonus falls back to. Each of those was restated per screen, and the
 * copies disagreed: that is exactly how the same day came to read as over target on one tab and
 * on track on another.
 */
export function dayCalorieTargets(
  profile: DayTargetProfileLike | null | undefined,
  weightKg: number | null,
  date: string,
): DayCalorieTargets {
  const targets = profileToTargets(profile, weightKg);
  const base = targets.maxCalories ?? targets.goalCalories;
  const isGymDay = (profile?.gymDays ?? []).includes(dayOfWeekMon0(date));
  const gymDayBonus = profile?.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS;

  return {
    target: base === null ? null : dayTargetKcal(base, isGymDay, gymDayBonus),
    min: targets.minCalories === null ? null : dayTargetKcal(targets.minCalories, isGymDay, gymDayBonus),
    isGymDay,
    gymDayBonus,
  };
}

/** The most recent weight value from a latest-per-type measurement list, or null if never recorded. */
export function latestWeightKg(measurements: { typeKey: string; value: number }[]): number | null {
  return measurements.find(m => m.typeKey === MeasurementTypes.Weight)?.value ?? null;
}

/**
 * The meal that follows the training session, per gym-time band. `pre_workout` and
 * `post_workout` are positioned relative to this anchor rather than being pinned to fixed
 * indexes, so a new band only needs an entry here.
 */
const GYM_TIME_ANCHOR: Record<GymTime, MealType> = {
  [GymTimes.Morning]: MealTypes.Breakfast,
  [GymTimes.Midday]: MealTypes.Lunch,
  [GymTimes.Evening]: MealTypes.Dinner,
};

/** The three fixed meals in clock order, plus the two that have no fixed moment in the day. */
const BASE_ORDER: MealType[] = [
  MealTypes.Breakfast,
  MealTypes.Lunch,
  MealTypes.Dinner,
  MealTypes.Snack,
  MealTypes.Other,
];

/** Order used when no gym-time band is set — the pre/post pair kept together at the tail. */
const ANCHORLESS_ORDER: MealType[] = [
  MealTypes.Breakfast,
  MealTypes.Lunch,
  MealTypes.Dinner,
  MealTypes.Snack,
  MealTypes.PreWorkout,
  MealTypes.PostWorkout,
  MealTypes.Other,
];

/**
 * The order a day's meal slots are displayed in, given when the user trains.
 *
 * `gymTime` identifies the meal that follows the session (morning → breakfast, midday → lunch,
 * evening → dinner), and the `pre_workout` / `post_workout` pair is spliced in immediately
 * before it: both happen either side of a session that ends just before that meal. A single
 * fixed order instead puts a morning trainer's pre-workout meal after dinner.
 *
 * `snack` and `other` stay at the tail in every case — neither has a fixed moment in the day.
 *
 * Returns every slot type, whether or not the day uses it; callers index into the result and
 * skip what they haven't planned.
 */
export function mealOrder(gymTime: GymTime | null): MealType[] {
  // No band set means no anchor to derive. Guessing a session time the user never gave would
  // reorder their plan on the strength of a default.
  if (!gymTime) return ANCHORLESS_ORDER;
  const anchor = GYM_TIME_ANCHOR[gymTime];
  return BASE_ORDER.flatMap(mealType =>
    mealType === anchor ? [MealTypes.PreWorkout, MealTypes.PostWorkout, mealType] : [mealType],
  );
}

/**
 * Function words stripped before comparing meal descriptions. Without this, two unrelated short
 * dishes can share enough connectors ("with", "cu", "de") to look alike; English and Romanian
 * cover the bilingual menu text this app actually sees.
 */
const MEAL_TEXT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'with',
  'of',
  'in',
  'on',
  'for',
  'to',
  'cu',
  'de',
  'la',
  'si',
  'pe',
  'un',
  'o',
  'ai',
  'al',
]);

/** Lowercased, diacritic-stripped, punctuation-stripped, stopword-filtered word set for one description. */
function mealTextTokens(text: string): Set<string> {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const words = normalized.split(/\s+/).filter(word => word.length > 0 && !MEAL_TEXT_STOPWORDS.has(word));
  return new Set(words);
}

/**
 * True when a freely-logged meal's description is close enough to a planned menu meal's
 * description that they are almost certainly the same dish — e.g. the assistant logged the
 * planned meal via `calories_log_meal` by describing it again, instead of the Hub's "Log it"
 * control (which links the two explicitly).
 *
 * Compares normalized, stopword-stripped word sets with Jaccard similarity (intersection over
 * union) so a side item logged on its own ("Ketchup, 20g") never satisfies a much larger planned
 * dish, while near-identical wording of the same meal does. Callers are expected to have already
 * narrowed to the same user, date and meal type — this only judges whether the *dish* matches.
 */
export function matchesPlannedMeal(loggedDescription: string, plannedDescription: string): boolean {
  const logged = mealTextTokens(loggedDescription);
  const planned = mealTextTokens(plannedDescription);
  if (logged.size === 0 || planned.size === 0) return false;

  let intersection = 0;
  for (const word of logged) {
    if (planned.has(word)) intersection++;
  }
  const union = logged.size + planned.size - intersection;

  return intersection / union >= 0.5;
}
