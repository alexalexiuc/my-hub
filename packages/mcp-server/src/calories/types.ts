export interface BodyProfile {
  name?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  sex?: string;
  activity_level?: string;
  goal_calories_override?: number;
  neck_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
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
