// Profile stores demographic/goal info for BMR/TDEE.
// Body measurements (height, weight, etc.) live in body_measurements table.
export interface BodyProfile {
  name?: string;
  age?: number;
  sex?: string;
  activity_level?: string;
  goal_calories_override?: number;
  notes?: string;
  updated_at?: string;
}

export interface MealEntry {
  meal_id: string;
  date: string;
  meal_type: string;
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
