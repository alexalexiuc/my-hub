import type { ActivityLevel, DayOfWeek, GoalType, GymTime, MealType, Sex } from '@my-hub/shared/constants';

// Profile stores demographic/goal info for BMR/TDEE.
// Height is stored directly on the profile (stable); weight lives in body_measurements.
export interface BodyProfile {
  name?: string;
  age?: number;
  sex?: Sex;
  heightCm?: number; // cm — stored directly on profile
  activityLevel?: ActivityLevel;
  goalType?: GoalType;
  goalWeeklyRateKg?: number; // kg/week for loss or gain
  goalMinCalories?: number; // explicit daily minimum floor
  goalMaxCalories?: number; // explicit daily maximum ceiling
  goalProtein?: number; // daily protein target in grams
  goalCarbs?: number; // daily carbohydrate target in grams
  goalFat?: number; // daily fat target in grams
  gymDays?: DayOfWeek[]; // days of week the user goes to the gym: 0=Mon … 6=Sun
  gymDayCalorieBonus?: number; // extra kcal the daily target rises by on a gym day
  gymTime?: GymTime; // when training happens: morning | midday | evening
  notes?: string;
  updatedAt?: string;
}

export interface MealEntry {
  mealId: string;
  date: string;
  mealType: MealType;
  description: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  createdAt: string;
}

export interface MeasurementEntry {
  id: number;
  type: string;
  label: string;
  value: number;
  unit: string;
  date: string;
  notes: string | null;
}
