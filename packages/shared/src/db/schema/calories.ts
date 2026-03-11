import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Calorie Tracker tables
// ---------------------------------------------------------------------------

export const calorieProfiles = pgTable("calorie_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  dailyGoalKcal: integer("daily_goal_kcal").notNull().default(2000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mealLogs = pgTable("meal_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
  description: text("description").notNull(),
  kcal: numeric("kcal", { precision: 8, scale: 2 }),
  protein: numeric("protein", { precision: 8, scale: 2 }),
  carbs: numeric("carbs", { precision: 8, scale: 2 }),
  fat: numeric("fat", { precision: 8, scale: 2 }),
  data: jsonb("data"), // raw nutritional payload
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
