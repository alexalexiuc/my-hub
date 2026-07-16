/**
 * Calorie tracker domain constants.
 * Keep these UI-safe (no DB/schema imports) so client components can import them directly.
 */
export const GoalTypes = {
  WeightLoss: 'weight_loss',
  WeightGain: 'weight_gain',
  Maintain: 'maintain',
} as const;

export type GoalType = (typeof GoalTypes)[keyof typeof GoalTypes];
export const GoalTypesValues: GoalType[] = Object.values(GoalTypes);

export const ActivityLevels = {
  /** Sedentary: little or no exercise */
  Sedentary: 'sedentary',
  /** LightlyActive: light exercise/sports 1-3 days/week */
  LightlyActive: 'lightly_active',
  /** ModeratelyActive: moderate exercise/sports 3-5 days/week */
  ModeratelyActive: 'moderately_active',
  /** VeryActive: hard exercise/sports 6-7 days a week */
  VeryActive: 'very_active',
  /** ExtraActive: very hard exercise/sports & physical job or 2x training */
  ExtraActive: 'extra_active',
} as const;

export type ActivityLevel = (typeof ActivityLevels)[keyof typeof ActivityLevels];
export const ActivityLevelsValues: ActivityLevel[] = Object.values(ActivityLevels);

export const Sexes = {
  Male: 'male',
  Female: 'female',
} as const;

export type Sex = (typeof Sexes)[keyof typeof Sexes];
export const SexesValues: Sex[] = Object.values(Sexes);

export const MealTypes = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
  Snack: 'snack',
  PreWorkout: 'pre_workout',
  PostWorkout: 'post_workout',
  Other: 'other',
} as const;

export type MealType = (typeof MealTypes)[keyof typeof MealTypes];
export const MealTypesValues: MealType[] = Object.values(MealTypes);

/** Default calorie bonus applied to a day's target when it's a gym day. Matches the `calorie_profiles.gym_day_calorie_bonus` column default — used as the fallback when a user has no profile row yet. */
export const DEFAULT_GYM_DAY_CALORIE_BONUS = 300;

/** Standing weekly-menu share permission levels. Only 'view' exists today; the column exists so edit-sharing can be added later without a migration. */
export const WeeklyMenuSharePermissions = {
  View: 'view',
} as const;

export type WeeklyMenuSharePermission = (typeof WeeklyMenuSharePermissions)[keyof typeof WeeklyMenuSharePermissions];
export const weeklyMenuSharePermissionValues: WeeklyMenuSharePermission[] = Object.values(WeeklyMenuSharePermissions);
