import { pgTable, serial, text, timestamp, integer, real, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Calorie Tracker tables
// ---------------------------------------------------------------------------

export const calorieProfiles = pgTable("calorie_profiles", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  // Body measurements for BMR/TDEE calculation (Mifflin-St Jeor)
  name: text("name"),
  age: integer("age"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  sex: text("sex"), // 'male' | 'female'
  activityLevel: text("activity_level"), // 'sedentary' | 'lightly_active' | ...
  goalCaloriesOverride: integer("goal_calories_override"),
  neckCm: real("neck_cm"),
  waistCm: real("waist_cm"),
  hipsCm: real("hips_cm"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mealLogs = pgTable(
  "meal_logs",
  {
    id: serial("id").primaryKey(),
    mealId: text("meal_id").unique(), // UUID for external reference (delete by ID)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(), // YYYY-MM-DD for easy filtering
    loggedAt: timestamp("logged_at").notNull().defaultNow(),
    mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
    description: text("description").notNull(),
    kcal: integer("kcal"),
    protein: real("protein"),
    carbs: real("carbs"),
    fat: real("fat"),
    notes: text("notes"),
    data: jsonb("data"), // raw nutritional payload
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_meal_logs_user").on(table.userId),
    dateIdx: index("idx_meal_logs_date").on(table.date),
    userDateIdx: index("idx_meal_logs_user_date").on(table.userId, table.date).desc(),
  }),
);
