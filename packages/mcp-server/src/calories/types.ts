// Profile stores demographic/goal info for BMR/TDEE.
// Body measurements (height, weight, etc.) live in body_measurements table.
export interface BodyProfile {
  name?: string;
  age?: number;
  sex?: string;
  activity_level?: string;
  goal_type?: string;           // 'weight_loss' | 'weight_gain' | 'maintain'
  goal_weekly_rate_kg?: number; // kg/week for loss or gain
  goal_min_calories?: number;   // explicit daily minimum floor
  goal_max_calories?: number;   // explicit daily maximum ceiling
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
