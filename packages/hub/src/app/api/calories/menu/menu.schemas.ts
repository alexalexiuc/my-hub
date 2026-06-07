import { z } from 'zod';
import { MealTypesValues, DaysOfWeek } from '@my-hub/shared/constants';

// ---------------------------------------------------------------------------
// Field-level primitives shared by every weekly-menu schema below. Centralising
// these avoids re-typing the same Zod chains (and the `nativeEnum` deprecation
// note) across the menu, meal, swap and log-day route contracts.
// ---------------------------------------------------------------------------

// Using deprecated `nativeEnum` because `enum` does not support number values
const DayOfWeekSchema = z.nativeEnum(DaysOfWeek);
const MealTypeSchema = z.enum(MealTypesValues);
const KcalSchema = z.number().int().positive();
const MacroGramsSchema = z.number().positive();
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
// `z.coerce.date()` (not `z.date()`): response payloads cross the wire as JSON, where Dates
// serialise to ISO strings — both the server's `route({ response })` validation and apiFetch's
// client-side `responseSchema` validation re-parse that JSON, so the schema must accept strings.
const TimestampSchema = z.coerce.date();

const MealSlotSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeSchema,
});

export const MenuParamsSchema = z.object({ menuId: z.string() });

// ---------------------------------------------------------------------------
// Meal payload contracts — one per distinct nullability shape:
//   - MenuMealInputSchema: meals supplied while creating a menu (macros may be
//     omitted, but never explicitly nulled)
//   - MenuMealWriteSchema: body shared by "add meal" and "swap meal" (macros
//     may be omitted or explicitly cleared with `null`)
//   - MenuMealRecordSchema: a persisted meal row as returned by the DB/API
// ---------------------------------------------------------------------------

export const MenuMealInputSchema = MealSlotSchema.extend({
  description: z.string().trim().min(1),
  kcal: KcalSchema.optional(),
  protein: MacroGramsSchema.optional(),
  carbs: MacroGramsSchema.optional(),
  fat: MacroGramsSchema.optional(),
});

export const MenuMealWriteSchema = MealSlotSchema.extend({
  description: z.string().min(1),
  kcal: KcalSchema.nullish(),
  protein: MacroGramsSchema.nullish(),
  carbs: MacroGramsSchema.nullish(),
  fat: MacroGramsSchema.nullish(),
});

export const MenuMealRecordSchema = MealSlotSchema.extend({
  id: z.number(),
  menuId: z.string(),
  description: z.string(),
  kcal: KcalSchema.nullable(),
  protein: MacroGramsSchema.nullable(),
  carbs: MacroGramsSchema.nullable(),
  fat: MacroGramsSchema.nullable(),
  createdAt: TimestampSchema,
});

/** Response shape for endpoints that return a single persisted meal (add meal, swap meal). */
export const MenuMealResponseSchema = z.object({ meal: MenuMealRecordSchema });

// ---------------------------------------------------------------------------
// Menu contracts
// ---------------------------------------------------------------------------

export const CreateMenuSchema = z.object({
  weekStart: IsoDateSchema,
  title: z.string().optional(),
  notes: z.string().optional(),
  meals: z.array(MenuMealInputSchema).min(1),
});

export const WeeklyMenuSchema = z.object({
  menuId: z.string(),
  weekStart: z.string(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  meals: z.array(MenuMealRecordSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  userId: z.string(),
});

export const WeeklyMenuWithoutMealsSchema = WeeklyMenuSchema.omit({ meals: true });

export const GetMenusResponseSchema = z.object({
  menus: z.array(WeeklyMenuWithoutMealsSchema),
  gymDays: z.array(DayOfWeekSchema),
});

export const GetMenuResponseSchema = z.object({
  menu: WeeklyMenuSchema.nullable(),
  loggedDays: z.record(z.string(), z.string()), // `{ [dayOfWeek:mealType]: '2020-01-01' }` for meals that have been logged
});

// ---------------------------------------------------------------------------
// Log-day contract
// ---------------------------------------------------------------------------

export const LogDayBodySchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  loggedDate: IsoDateSchema,
  mealType: MealTypeSchema,
});

export const LogDayResponseSchema = z.object({
  marked: z.boolean(),
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeSchema,
  loggedDate: z.string(),
});
