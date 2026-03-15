export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
}

export enum ActivityLevel {
  SEDENTARY = 'sedentary',
  LIGHTLY_ACTIVE = 'lightly_active',
  MODERATELY_ACTIVE = 'moderately_active',
  VERY_ACTIVE = 'very_active',
  EXTRA_ACTIVE = 'extra_active',
}

export enum Sex {
  MALE = 'male',
  FEMALE = 'female',
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
};

export const DEFAULT_MEAL_LIMIT = 50;
export const MAX_MEAL_LIMIT = 500;

export const MEAL_TYPE_FRACTIONS: Record<MealType, number> = {
  [MealType.BREAKFAST]: 0.25,
  [MealType.LUNCH]: 0.35,
  [MealType.DINNER]: 0.3,
  [MealType.SNACK]: 0.1,
};
