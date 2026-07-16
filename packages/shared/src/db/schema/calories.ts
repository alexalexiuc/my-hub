import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  uuid,
  index,
  unique,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import type { ActivityLevel, GoalType, MealType, Sex, WeeklyMenuSharePermission } from '../../constants/calories';
import { WeeklyMenuSharePermissions } from '../../constants/calories';
import { users } from './users';
import type { DayOfWeek } from '../../constants/weekly-menu';

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
  age: integer('age'),
  sex: text('sex').$type<Sex>(), // 'male' | 'female'
  heightCm: real('height_cm'), // cm — stable, stored directly on profile
  activityLevel: text('activity_level').$type<ActivityLevel>(), // 'sedentary' | 'lightly_active' | ...
  goalType: text('goal_type').$type<GoalType>(), // 'weight_loss' | 'weight_gain' | 'maintain'
  goalWeeklyRateKg: real('goal_weekly_rate_kg'), // kg/week for loss or gain
  goalMinCalories: integer('goal_min_calories'), // explicit daily minimum floor
  goalMaxCalories: integer('goal_max_calories'), // explicit daily maximum ceiling
  goalProtein: real('goal_protein'), // optional daily protein target in grams
  goalCarbs: real('goal_carbs'), // optional daily carbs target in grams
  goalFat: real('goal_fat'), // optional daily fat target in grams
  gymDays: jsonb('gym_days').$type<DayOfWeek[]>(), // days of week user goes to gym: 0=Mon … 6=Sun
  gymDayCalorieBonus: real('gym_day_calorie_bonus').default(300), // kcal added to the daily target on gym days
  notes: text('notes'),
  automationApiKey: text('automation_api_key'),
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
  table => [
    index('idx_meal_logs_user').on(table.userId),
    index('idx_meal_logs_date').on(table.date),
    index('idx_meal_logs_user_date').on(table.userId, table.date.desc()),
  ],
);

// ---------------------------------------------------------------------------
// Weekly Menu tables
// ---------------------------------------------------------------------------

export const weeklyMenus = pgTable(
  'weekly_menus',
  {
    menuId: text('menu_id').primaryKey(), // UUID for external reference
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    weekStart: text('week_start').notNull(), // YYYY-MM-DD (Monday of the week)
    title: text('title'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => [
    index('idx_weekly_menus_user').on(table.userId),
    index('idx_weekly_menus_user_week').on(table.userId, table.weekStart.desc()),
  ],
);

export const weeklyMenuMeals = pgTable(
  'weekly_menu_meals',
  {
    id: serial('id').primaryKey(),
    menuId: text('menu_id')
      .notNull()
      .references(() => weeklyMenus.menuId, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull().$type<DayOfWeek>(), // 0=Monday … 6=Sunday
    mealType: text('meal_type').$type<MealType>().notNull(),
    description: text('description').notNull(),
    kcal: integer('kcal'),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [
    index('idx_weekly_menu_meals_menu').on(table.menuId),
    // One meal per slot — addMealToMenu's onConflictDoNothing and the slot-addressed
    // update/delete service functions all rely on this invariant.
    unique('uq_weekly_menu_meal_slot').on(table.menuId, table.dayOfWeek, table.mealType),
  ],
);

export const weeklyMenuShoppingItems = pgTable(
  'weekly_menu_shopping_items',
  {
    id: serial('id').primaryKey(),
    menuId: text('menu_id')
      .notNull()
      .references(() => weeklyMenus.menuId, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    text: text('text').notNull(),
    checked: boolean('checked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [
    index('idx_weekly_menu_shopping_items_menu').on(table.menuId),
    // One item per exact text per menu — backstop for the service-level
    // case-insensitive dedupe (insert uses onConflictDoNothing).
    unique('uq_weekly_menu_shopping_item').on(table.menuId, table.text),
  ],
);

export const weeklyMenuDayLogs = pgTable(
  'weekly_menu_day_logs',
  {
    id: serial('id').primaryKey(),
    menuId: text('menu_id')
      .notNull()
      .references(() => weeklyMenus.menuId, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull().$type<DayOfWeek>(), // 0=Monday … 6=Sunday
    mealType: text('meal_type').$type<MealType>().notNull(), // breakfast | lunch | dinner | snack
    loggedDate: text('logged_date').notNull(), // YYYY-MM-DD — the calendar date it was logged for
    loggedAt: timestamp('logged_at').notNull().defaultNow(),
  },
  table => [unique('uq_weekly_menu_day_log').on(table.menuId, table.dayOfWeek, table.mealType)],
);

// Standing share of a user's weekly menus with another user — not tied to a
// specific menuId, since it must cover the owner's current and future weeks.
export const weeklyMenuShares = pgTable(
  'weekly_menu_shares',
  {
    id: serial('id').primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sharedWithUserId: uuid('shared_with_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission')
      .$type<WeeklyMenuSharePermission>()
      .notNull()
      .default(WeeklyMenuSharePermissions.View),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => [
    uniqueIndex('uniq_weekly_menu_shares_owner_shared_with').on(table.ownerUserId, table.sharedWithUserId),
    index('idx_weekly_menu_shares_shared_with_user_id').on(table.sharedWithUserId),
  ],
);
