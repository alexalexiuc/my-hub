import { pgTable, serial, text, timestamp, integer, real, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import type { ActivityLevel, GoalType, MealType, Sex } from '../../constants/calories';
import { users } from './users';

// ---------------------------------------------------------------------------
// Calorie Tracker tables
// ---------------------------------------------------------------------------

export const calorieProfiles = pgTable('calorie_profiles', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  // Demographic & goal info for BMR/TDEE calculation (Mifflin-St Jeor)
  // Height is stored here (stable); weight and other changing measurements are in body_measurements table
  name: text('name'),
  age: integer('age'),
  sex: text('sex').$type<Sex>(), // 'male' | 'female'
  heightCm: real('height_cm'), // cm — stable, stored directly on profile
  activityLevel: text('activity_level').$type<ActivityLevel>(), // 'sedentary' | 'lightly_active' | ...
  goalType: text('goal_type').$type<GoalType>(), // 'weight_loss' | 'weight_gain' | 'maintain'
  goalWeeklyRateKg: real('goal_weekly_rate_kg'), // kg/week for loss or gain
  goalMinCalories: integer('goal_min_calories'), // explicit daily minimum floor
  goalMaxCalories: integer('goal_max_calories'), // explicit daily maximum ceiling
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mealLogs = pgTable(
  'meal_logs',
  {
    id: serial('id').primaryKey(),
    mealId: text('meal_id').unique(), // UUID for external reference (delete by ID)
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    date: text('date').notNull(), // YYYY-MM-DD for easy filtering
    loggedAt: timestamp('logged_at').notNull().defaultNow(),
    mealType: text('meal_type').$type<MealType>().notNull(), // breakfast | lunch | dinner | snack
    description: text('description').notNull(),
    kcal: integer('kcal'),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
    notes: text('notes'),
    data: jsonb('data'), // raw nutritional payload
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_meal_logs_user').on(table.userId),
    dateIdx: index('idx_meal_logs_date').on(table.date),
    userDateIdx: index('idx_meal_logs_user_date').on(table.userId, table.date).desc(),
  }),
);
