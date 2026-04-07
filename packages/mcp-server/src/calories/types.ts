import type { ActivityLevel, GoalType, MealType, Sex } from '@my-hub/shared/constants';

// Profile stores demographic/goal info for BMR/TDEE.
// Height is stored directly on the profile (stable); weight lives in body_measurements.
export interface BodyProfile {
  name?: string;
  age?: number;
  sex?: Sex;
  height_cm?: number; // cm — stored directly on profile
  activity_level?: ActivityLevel;
  goal_type?: GoalType;
  goal_weekly_rate_kg?: number; // kg/week for loss or gain
  goal_min_calories?: number; // explicit daily minimum floor
  goal_max_calories?: number; // explicit daily maximum ceiling
  notes?: string;
  updated_at?: string;
}

export interface MealEntry {
  meal_id: string;
  date: string;
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  created_at: string;
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
