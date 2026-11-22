import { z } from 'zod';
import type { CalorieProfile } from '@my-hub/shared/types';
import {
  ActivityLevel,
  ActivityLevels,
  DaysOfWeek,
  GoalType,
  GoalTypes,
  GymTimesValues,
  GYM_TIME_LABELS,
} from '@my-hub/shared/constants';
import { pctToGrams } from './calories.utils';

export type MacroMode = 'g' | '%';

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: ActivityLevels.Sedentary, label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: ActivityLevels.LightlyActive, label: 'Lightly active', description: 'Light exercise 1-3 days/week' },
  {
    value: ActivityLevels.ModeratelyActive,
    label: 'Moderately active',
    description: 'Moderate exercise 3-5 days/week',
  },
  { value: ActivityLevels.VeryActive, label: 'Very active', description: 'Hard exercise 6-7 days/week' },
  { value: ActivityLevels.ExtraActive, label: 'Extra active', description: 'Very hard exercise, physical job' },
];

export const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map(o => [o.value, o.label]),
);
export const ACTIVITY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  ACTIVITY_OPTIONS.map(o => [o.value, o.description]),
);

export const GYM_TIME_OPTIONS = GymTimesValues.map(value => ({ value, label: GYM_TIME_LABELS[value] }));

export const GOAL_LABELS: Record<GoalType, string> = {
  [GoalTypes.WeightLoss]: 'Lose weight',
  [GoalTypes.Maintain]: 'Maintain',
  [GoalTypes.WeightGain]: 'Gain weight',
};

/** The goal-type select's choices, in the order the form lists them. */
export const GOAL_OPTIONS = [GoalTypes.WeightLoss, GoalTypes.Maintain, GoalTypes.WeightGain].map(value => ({
  value,
  label: GOAL_LABELS[value],
}));

/**
 * Field explanations shown behind the info icon on each `Field`.
 *
 * These used to be placeholders, which does not work: a placeholder disappears the moment the user
 * types, is clipped by the width of the input, and reads like a value rather than guidance. Goal
 * weight was the clearest case — its explanation was far wider than the field could ever show.
 */
export const FIELD_INFO = {
  weight:
    "Saved as today's weigh-in rather than a profile field, so it feeds the weight history and trend. Every calorie target needs it — without a weigh-in the feature reports no goal set. Re-saving the form only writes a new entry when the number actually changed.",
  gymDayCalorieBonus: 'Extra calories allowed on the days marked above, on top of your normal target.',
  gymTime:
    'A rough band, not a clock time. It only decides which meals count as before or after the session when planning a day.',
  goalWeeklyRate:
    'How fast you intend to move, in kg per week. This is what sets the size of the daily deficit or surplus.',
  goalTargetWeight:
    'Optional finish line. With one, the Progress card shows how far through the run you are and estimates a finish date from the rate you are actually achieving. Leave it blank to track the rate alone, with no progress bar or estimate.',
  goalMinCalories:
    'A floor the calculated target will not drop below, however aggressive the goal rate is. Leave blank for no floor.',
  goalMaxCalories:
    'A ceiling for the daily target. It is also the total that macro percentages are worked out against, so % mode needs it.',
} as const;

export const ProfileFormSchema = z
  .object({
    age: z.string(),
    sex: z.string(),
    heightCm: z.string(),
    /**
     * Weight is not a profile column — it is the latest `weight` measurement, and saving the form
     * writes a new one. It lives here anyway because every calorie target depends on it: without a
     * weight the whole feature reports "no goal set", and the only place to enter one used to be a
     * modal on another tab, which this card's own "Set up profile" link did not lead to.
     */
    weightKg: z.string(),
    activityLevel: z.string(),
    goalType: z.string(),
    goalWeeklyRateKg: z.string(),
    /** Optional finish line. Blank leaves the goal an open-ended rate with no progress bar or ETA. */
    goalTargetWeightKg: z.string(),
    goalMinCalories: z.string(),
    goalMaxCalories: z.string(),
    goalProtein: z.string(),
    goalCarbs: z.string(),
    goalFat: z.string(),
    gymDays: z.nativeEnum(DaysOfWeek).array(), // Using deprecated `nativeEnum` because `enum` does not support number values
    gymDayCalorieBonus: z.string(),
    gymTime: z.string(), // '' = not set; the Select's blank option
    notes: z.string(),
  })
  // A floor above the ceiling leaves no day on target; the server refuses it too.
  .refine(v => !v.goalMinCalories || !v.goalMaxCalories || Number(v.goalMinCalories) <= Number(v.goalMaxCalories), {
    path: ['goalMinCalories'],
    message: "Min can't be above max",
  });

export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

/** The form's starting values: the saved profile, with the latest weigh-in as the weight. */
export function buildFormValues(profile: CalorieProfile | null, weightKg: number | undefined): ProfileFormValues {
  return {
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    weightKg: weightKg?.toString() ?? '',
    activityLevel: profile?.activityLevel ?? '',
    goalType: profile?.goalType ?? '',
    goalWeeklyRateKg: profile?.goalWeeklyRateKg?.toString() ?? '',
    goalTargetWeightKg: profile?.goalTargetWeightKg?.toString() ?? '',
    goalMinCalories: profile?.goalMinCalories?.toString() ?? '',
    goalMaxCalories: profile?.goalMaxCalories?.toString() ?? '',
    goalProtein: profile?.goalProtein?.toString() ?? '',
    goalCarbs: profile?.goalCarbs?.toString() ?? '',
    goalFat: profile?.goalFat?.toString() ?? '',
    gymDays: profile?.gymDays ?? [],
    gymDayCalorieBonus: profile?.gymDayCalorieBonus?.toString() ?? '',
    gymTime: profile?.gymTime ?? '',
    notes: profile?.notes ?? '',
  };
}

/**
 * The `PUT /api/calories/profile` body for the form. Macros typed as percentages are converted
 * to grams against the max calories (`maxCalNum`).
 */
export function formToProfileBody(values: ProfileFormValues, macroMode: MacroMode, maxCalNum: number | null) {
  const macroGrams = (value: string, kcalPerGram: number) =>
    value ? Number(macroMode === '%' ? pctToGrams(value, kcalPerGram, maxCalNum ?? 0) : value) : null;
  return {
    age: values.age ? Number(values.age) : undefined,
    sex: values.sex || undefined,
    heightCm: values.heightCm ? Number(values.heightCm) : undefined,
    activityLevel: values.activityLevel || undefined,
    // Null rather than undefined, so picking "— no goal —" and saving actually clears it
    // instead of being silently ignored as "leave unchanged".
    goalType: values.goalType || null,
    goalWeeklyRateKg: values.goalWeeklyRateKg ? Number(values.goalWeeklyRateKg) : null,
    // Null rather than undefined, so clearing the field actually removes the finish line.
    goalTargetWeightKg: values.goalTargetWeightKg ? Number(values.goalTargetWeightKg) : null,
    goalMinCalories: values.goalMinCalories ? Math.round(Number(values.goalMinCalories)) : null,
    goalMaxCalories: values.goalMaxCalories ? Math.round(Number(values.goalMaxCalories)) : null,
    goalProtein: macroGrams(values.goalProtein, 4),
    goalCarbs: macroGrams(values.goalCarbs, 4),
    goalFat: macroGrams(values.goalFat, 9),
    gymDays: values.gymDays.length > 0 ? values.gymDays : null,
    // Whole kcal: the API takes an integer, and a day's range is counted in whole calories.
    gymDayCalorieBonus: values.gymDayCalorieBonus ? Math.round(Number(values.gymDayCalorieBonus)) : null,
    gymTime: values.gymTime || null,
    notes: values.notes.trim() || null,
  };
}
