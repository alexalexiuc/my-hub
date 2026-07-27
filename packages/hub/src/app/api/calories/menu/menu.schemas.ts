import { z } from 'zod';
import { MealTypesValues, DaysOfWeek } from '@my-hub/shared/constants';
import { hasDuplicateMealSlot } from '@my-hub/shared/utils';

// Re-exported for CreateMenuModal's live duplicate hint — the rule itself lives in
// shared so the Hub API, the modal, and the MCP create tool can never disagree.
export { hasDuplicateMealSlot };

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
/** Free-text ingredient lines for one dish, e.g. ["200g chicken breast", "1 red pepper"]. */
const IngredientsSchema = z.array(z.string().trim().min(1));
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

/** Body for DELETE /api/calories/menu/[menuId]/meals — identifies the slot to remove. */
export const DeleteMenuMealSchema = MealSlotSchema;

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
  ingredients: IngredientsSchema.optional(),
  kcal: KcalSchema.optional(),
  protein: MacroGramsSchema.optional(),
  carbs: MacroGramsSchema.optional(),
  fat: MacroGramsSchema.optional(),
});

export const MenuMealWriteSchema = MealSlotSchema.extend({
  description: z.string().min(1),
  ingredients: IngredientsSchema.nullish(),
  kcal: KcalSchema.nullish(),
  protein: MacroGramsSchema.nullish(),
  carbs: MacroGramsSchema.nullish(),
  fat: MacroGramsSchema.nullish(),
});

export const MenuMealRecordSchema = MealSlotSchema.extend({
  id: z.number(),
  menuId: z.string(),
  description: z.string(),
  ingredients: IngredientsSchema.nullable(),
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

export const CreateMenuSchema = z
  .object({
    weekStart: IsoDateSchema,
    title: z.string().optional(),
    notes: z.string().optional(),
    meals: z.array(MenuMealInputSchema).min(1),
    /**
     * The week's shopping list. Carried here so copying a week can bring the list with it —
     * the service already writes it in the same transaction as the meals. This is transport,
     * not authoring: FR-18 still says the list's *content* is written by the assistant.
     */
    shoppingList: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(({ meals }) => !hasDuplicateMealSlot(meals), {
    message: 'Duplicate meal slot — each (dayOfWeek, mealType) pair may appear at most once',
    path: ['meals'],
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

/**
 * Body for PATCH /api/calories/menu/[menuId]/details — the menu's own fields. Both are nullish:
 * omitted leaves the field alone, explicit `null` clears it (the service's `omitUndefined` rule).
 */
export const UpdateMenuDetailsSchema = z.object({
  title: z.string().trim().nullish(),
  notes: z.string().nullish(),
});

export const UpdateMenuDetailsResponseSchema = z.object({ menu: WeeklyMenuWithoutMealsSchema });

export const GetMenusResponseSchema = z.object({
  menus: z.array(WeeklyMenuWithoutMealsSchema),
  gymDays: z.array(DayOfWeekSchema),
  /** Daily calorie target from the user's profile (goalCalories), or null if the profile is incomplete. */
  goalCalories: z.number().nullable(),
  /** Extra kcal added to the daily target on gym days. */
  gymDayCalorieBonus: z.number(),
});

export const GetMenuResponseSchema = z.object({
  menu: WeeklyMenuSchema.nullable(),
  loggedDays: z.record(z.string(), z.string()), // `{ [dayOfWeek:mealType]: '2020-01-01' }` for meals that have been logged
});

/**
 * Query + response for GET /api/calories/menu/today — the planned meals for one calendar day,
 * each flagged with whether it has been logged. The date comes from the client rather than being
 * derived server-side: the browser knows its own local day, and deriving it from server time
 * would put the two an hour apart either side of midnight.
 */
export const TodayPlanQuerySchema = z.object({ date: IsoDateSchema });

export const TodayPlanResponseSchema = z.object({
  /** Null when the week has no menu at all — the caller renders nothing rather than an empty card. */
  menuId: z.string().nullable(),
  meals: z.array(MenuMealRecordSchema.extend({ logged: z.boolean() })),
});

/** Response shape for POST /api/calories/menu */
export const CreateMenuResponseSchema = z.object({ menu: WeeklyMenuSchema });

// ---------------------------------------------------------------------------
// Shopping list contracts
// ---------------------------------------------------------------------------

export const ShoppingItemParamsSchema = z.object({ menuId: z.string(), itemId: z.coerce.number().int() });

export const ShoppingItemRecordSchema = z.object({
  id: z.number(),
  menuId: z.string(),
  text: z.string(),
  checked: z.boolean(),
  createdAt: TimestampSchema,
});

/** Response shape for GET /api/calories/menu/[menuId]/shopping-list. */
export const GetShoppingListResponseSchema = z.object({ items: z.array(ShoppingItemRecordSchema) });

/** Body for POST — one or more item texts. */
export const AddShoppingItemsSchema = z.object({ texts: z.array(z.string().trim().min(1)).min(1) });

/** Response for POST — only the rows that were actually inserted (duplicates are skipped). */
export const AddShoppingItemsResponseSchema = z.object({ items: z.array(ShoppingItemRecordSchema) });

/** Body for PATCH /api/calories/menu/[menuId]/shopping-list/[itemId]. */
export const UpdateShoppingItemSchema = z.object({ checked: z.boolean() });

/** Response shape for endpoints that return a single shopping list item. */
export const ShoppingItemResponseSchema = z.object({ item: ShoppingItemRecordSchema });

// ---------------------------------------------------------------------------
// Log-day contract
// ---------------------------------------------------------------------------

/**
 * Body for POST /api/calories/menu/[menuId]/log-day — the slot to mark plus the meal
 * snapshot to journal. The route writes the calorie-journal entry and the slot marker
 * in one transaction (`logMenuMeal`), so clients make a single call instead of
 * stitching /api/calories/meals and log-day together.
 */
export const LogDayBodySchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  loggedDate: IsoDateSchema,
  mealType: MealTypeSchema,
  description: z.string().min(1),
  kcal: KcalSchema.nullish(),
  protein: MacroGramsSchema.nullish(),
  carbs: MacroGramsSchema.nullish(),
  fat: MacroGramsSchema.nullish(),
});

/**
 * Body for the day-scoped variants of the log-day route. No meal details: the service reads the
 * plan itself, so the journal cannot drift from it, and one transaction replaces one request
 * per slot.
 */
export const LogWholeDaySchema = z.object({ dayOfWeek: DayOfWeekSchema, loggedDate: IsoDateSchema });
export const UnlogWholeDaySchema = z.object({ dayOfWeek: DayOfWeekSchema });
export const WholeDayResponseSchema = z.object({ affected: z.number().int().nonnegative() });

export const LogDayResponseSchema = z.object({
  marked: z.boolean(),
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeSchema,
  loggedDate: z.string(),
});
