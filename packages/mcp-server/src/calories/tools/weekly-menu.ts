import { z } from 'zod';
import {
  createWeeklyMenu,
  updateWeeklyMenu,
  getWeeklyMenuByWeek,
  getWeeklyMenus,
  getCalorieProfile,
  getLatestMeasurementsPerType,
  upsertMenuMeal,
  deleteWeeklyMenuMeal,
  deleteWeeklyMenu,
  replaceShoppingListItems,
} from '@my-hub/shared/services';
import {
  MealTypesValues,
  DaysOfWeek,
  DAY_LABELS_SHORT,
  MeasurementTypes,
  DEFAULT_GYM_DAY_CALORIE_BONUS,
} from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';
import { toolResponse } from '../../shared/toolsUtils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import type { ToolHandler } from '../../shared/types';
import { rowToProfile, profileToTargets } from '../models/profile';
import { localDateString, startOfWeekMonday, dateToString, hasDuplicateMealSlot, logger } from '@my-hub/shared/utils';

/** Convert a YYYY-MM-DD date string to day-of-week in Mon=0 … Sun=6 format. */
function dayOfWeekMon0(dateStr: string): DayOfWeek {
  const jsDay = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  return ((jsDay + 6) % 7) as DayOfWeek;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Meal-slot enum derived from the shared MealTypes source of truth so new members
 * (e.g. `other`) propagate automatically instead of drifting from the Hub schemas.
 */
const mealTypeSchema = z
  .enum(MealTypesValues as [MealType, ...MealType[]])
  .describe('breakfast | lunch | dinner | snack | pre_workout | post_workout | other');

const MenuMealSchema = z.object({
  dayOfWeek: z
    .nativeEnum(DaysOfWeek)
    .describe('Day of week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday'),
  mealType: mealTypeSchema,
  description: z.string().describe('What to eat, e.g. "Grilled salmon with quinoa and broccoli"'),
  kcal: z.number().int().positive().optional().describe('Estimated calories'),
  protein: z.number().positive().optional().describe('Protein in grams'),
  carbs: z.number().positive().optional().describe('Carbohydrates in grams'),
  fat: z.number().positive().optional().describe('Fat in grams'),
});

export const PlanWeekSchema = z.object({
  weekStart: yyyyMmDdSchema.describe(
    'The Monday of the target week in YYYY-MM-DD format. Use the upcoming Monday for "next week", or the current Monday for "this week".',
  ),
  title: z.string().optional().describe('Optional menu title, e.g. "High protein week"'),
  prepNotes: z
    .string()
    .optional()
    .describe(
      'Optional free-text prep & cooking notes for the week — batch-cooking and "cook once, eat twice" guidance, ' +
        'e.g. "Roast 1kg chicken breast Sunday → use for Mon lunch, Thu & Sun dinner. Make overnight oats x4 for breakfasts." ' +
        'Written for the user to read in the hub; keep it practical.',
    ),
  shoppingList: z
    .array(z.string())
    .optional()
    .describe(
      'Optional shopping list for the week, one entry per line with quantities where useful, ' +
        'e.g. ["1kg chicken breast", "6 eggs", "500g oats", "2 avocados"]. Aggregate ingredients across all ' +
        'planned meals so the user can shop once. Replaces any existing list for the week.',
    ),
  meals: z
    .array(MenuMealSchema)
    .min(1)
    .describe(
      "Planned meals for the week. For the current week, only include meals from today's day of week onwards (check planFromDayOfWeek in the tool response context). For future weeks, include all 7 days. Always include breakfast, lunch, dinner, and snack for each planned day.",
    ),
});

export const GetWeeklyMenuSchema = z.object({
  weekStart: yyyyMmDdSchema
    .optional()
    .describe('The Monday of the week to retrieve (YYYY-MM-DD). Omit to list all menus.'),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const planWeekTool: ToolHandler<typeof PlanWeekSchema.shape> = async (input, context) => {
  const { userId } = context;

  // Same rule the Hub API enforces — reject instead of letting the unique-slot
  // constraint's onConflictDoNothing silently drop meals with no feedback.
  if (hasDuplicateMealSlot(input.meals)) {
    return toolResponse({
      success: false,
      message:
        'Duplicate meal slot — each (dayOfWeek, mealType) pair may appear at most once per week. Merge the duplicates and call the tool again.',
    });
  }

  // Compute today's date and day-of-week in the user's timezone
  const todayDate = localDateString(context.timezone);
  const todayDayOfWeek = dayOfWeekMon0(todayDate);
  const currentWeekStart = dateToString(startOfWeekMonday(new Date(todayDate + 'T00:00:00')));
  const isCurrentWeek = input.weekStart === currentWeekStart;
  // For the current week, only plan from today onwards; for future weeks, plan all 7 days
  const planFromDayOfWeek = isCurrentWeek ? todayDayOfWeek : 0;

  // Fetch the user's calorie profile and latest weight to compute their daily targets
  const [profileRow, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  // Gym days from profile — used to label training vs rest days in the response
  const gymDays = profile.gymDays ?? [];
  const gymDayCalorieBonus = profileRow?.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS;

  // Validate that planned meals respect the user's daily calorie targets
  const warnings: string[] = [];
  if (targets.maxCalories !== null || targets.minCalories !== null) {
    // Group meals by day and sum kcal
    const dailyKcal: Record<number, number> = {};
    for (const m of input.meals) {
      dailyKcal[m.dayOfWeek] = (dailyKcal[m.dayOfWeek] ?? 0) + (m.kcal ?? 0);
    }

    for (const [day, kcal] of Object.entries(dailyKcal)) {
      if (kcal === 0) continue;
      // Gym days carry a higher target — same rule the Hub UI applies via dayTargetKcal,
      // so the tool never warns about a correctly-planned gym day.
      const bonus = gymDays.includes(Number(day) as DayOfWeek) ? gymDayCalorieBonus : 0;
      const gymNote = bonus > 0 ? ' (gym day — bonus included)' : '';
      if (targets.maxCalories !== null && kcal > targets.maxCalories + bonus) {
        warnings.push(`Day ${day}: ${kcal} kcal exceeds max target of ${targets.maxCalories + bonus} kcal${gymNote}`);
      }
      if (targets.minCalories !== null && kcal < targets.minCalories + bonus) {
        warnings.push(`Day ${day}: ${kcal} kcal is below min target of ${targets.minCalories + bonus} kcal${gymNote}`);
      }
    }
  }

  let menu: Awaited<ReturnType<typeof createWeeklyMenu>>;
  try {
    menu = await createWeeklyMenu({
      userId,
      weekStart: input.weekStart,
      title: input.title ?? null,
      notes: input.prepNotes ?? null,
      meals: input.meals.map(m => ({
        dayOfWeek: m.dayOfWeek,
        mealType: m.mealType,
        description: m.description,
        kcal: m.kcal ?? null,
        protein: m.protein ?? null,
        carbs: m.carbs ?? null,
        fat: m.fat ?? null,
      })),
    });
  } catch (err) {
    logger.error(`[calories] planWeek failed for user ${userId}, week ${input.weekStart}:`, err);
    return toolResponse({
      success: false,
      message: `Could not save the weekly menu for ${input.weekStart}. Please try again.`,
    });
  }

  // Write the shopping list in the same flow so the AI can plan meals + shopping in one call.
  let shoppingListCount = 0;
  if (input.shoppingList && input.shoppingList.length > 0) {
    const items = await replaceShoppingListItems(userId, menu.menuId, input.shoppingList);
    shoppingListCount = items?.length ?? 0;
  }

  return toolResponse({
    menuId: menu.menuId,
    weekStart: menu.weekStart,
    title: menu.title,
    totalMeals: menu.meals.length,
    prepNotes: menu.notes,
    shoppingListItems: shoppingListCount,
    todayDate,
    todayDayOfWeek,
    planFromDayOfWeek,
    noProfile: !profileRow,
    noTargets: !!profileRow && targets.maxCalories === null && targets.minCalories === null,
    userTargets: profileRow
      ? {
          goalType: profile.goalType ?? null,
          dailyCalories: {
            min: targets.minCalories,
            goal: targets.goalCalories,
            max: targets.maxCalories,
          },
          macros: {
            protein: profileRow.goalProtein ?? null,
            carbs: profileRow.goalCarbs ?? null,
            fat: profileRow.goalFat ?? null,
          },
          gymDays: gymDays.length > 0 ? gymDays : null,
          gymDayCalorieBonus,
        }
      : null,
    warnings: warnings.length > 0 ? warnings : null,
    message: !profileRow
      ? `Weekly menu saved for ${menu.weekStart} as a balanced default — no calorie profile is set so meals were not tailored to specific targets. Suggest the user sets up their profile under Calories → Settings.`
      : `Weekly menu saved for ${menu.weekStart}. The user can view it in the hub under Calories → Weekly Menu.${isCurrentWeek && planFromDayOfWeek > 0 ? ` Only planned from ${DAY_LABELS_SHORT[planFromDayOfWeek]} (today) onwards — past days were skipped.` : ''}${gymDays.length > 0 ? ` Gym days (${gymDays.map(d => DAY_LABELS_SHORT[d]).join(', ')}) have been taken into account — plan higher calories/carbs on those days.` : ''}${warnings.length > 0 ? " Note: some days exceed the user's calorie targets — consider revising." : ''}`,
  });
};

export const getWeeklyMenuTool: ToolHandler<typeof GetWeeklyMenuSchema.shape> = async (input, context) => {
  const { userId } = context;

  const [profileRow, menuResult] = await Promise.all([
    getCalorieProfile(userId),
    input.weekStart ? getWeeklyMenuByWeek(userId, input.weekStart) : getWeeklyMenus(userId),
  ]);
  const gymDays: number[] = profileRow ? (rowToProfile(profileRow).gymDays ?? []) : [];
  const gymDaysOrNull = gymDays.length > 0 ? gymDays : null;

  if (input.weekStart) {
    if (!menuResult) return toolResponse({ menu: null, message: `No menu found for week of ${input.weekStart}.` });
    return toolResponse({ menu: menuResult, gymDays: gymDaysOrNull });
  }

  return toolResponse({ menus: menuResult, gymDays: gymDaysOrNull });
};

// ---------------------------------------------------------------------------
// Set (add or swap) a single meal
// ---------------------------------------------------------------------------

export const SetMenuMealSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu to update'),
  dayOfWeek: z.nativeEnum(DaysOfWeek).describe('Day of week: 0=Monday … 6=Sunday'),
  mealType: mealTypeSchema,
  description: z.string().describe('What to eat, e.g. "Grilled salmon with quinoa and broccoli"'),
  kcal: z.number().int().positive().optional().describe('Estimated calories'),
  protein: z.number().positive().optional().describe('Protein in grams'),
  carbs: z.number().positive().optional().describe('Carbohydrates in grams'),
  fat: z.number().positive().optional().describe('Fat in grams'),
});

export const setMenuMealTool: ToolHandler<typeof SetMenuMealSchema.shape> = async (input, context) => {
  const { userId } = context;

  const meal = await upsertMenuMeal(userId, input.menuId, {
    dayOfWeek: input.dayOfWeek,
    mealType: input.mealType,
    description: input.description,
    kcal: input.kcal ?? null,
    protein: input.protein ?? null,
    carbs: input.carbs ?? null,
    fat: input.fat ?? null,
  });

  if (!meal) {
    return toolResponse({ success: false, message: `Menu ${input.menuId} not found.` });
  }

  const dayName = DAY_LABELS_SHORT[input.dayOfWeek];
  return toolResponse({
    success: true,
    meal,
    message: `Set ${input.mealType} on ${dayName}: "${input.description}"${input.kcal ? ` (${input.kcal} kcal)` : ''}. The user can see the updated menu under Calories → Weekly Menu.`,
  });
};

// ---------------------------------------------------------------------------
// Remove a single meal
// ---------------------------------------------------------------------------

export const RemoveMenuMealSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu to remove the meal from'),
  dayOfWeek: z.nativeEnum(DaysOfWeek).describe('Day of week: 0=Monday … 6=Sunday'),
  mealType: mealTypeSchema,
});

export const removeMenuMealTool: ToolHandler<typeof RemoveMenuMealSchema.shape> = async (input, context) => {
  const { userId } = context;

  const removed = await deleteWeeklyMenuMeal(userId, input.menuId, input.dayOfWeek, input.mealType);

  if (!removed) {
    return toolResponse({
      success: false,
      message: `No ${input.mealType} found for day ${input.dayOfWeek} in menu ${input.menuId}.`,
    });
  }

  const dayName = DAY_LABELS_SHORT[input.dayOfWeek];
  return toolResponse({
    success: true,
    message: `Removed ${input.mealType} on ${dayName} from the menu. The user can see the updated menu under Calories → Weekly Menu.`,
  });
};

// ---------------------------------------------------------------------------
// Delete a whole menu
// ---------------------------------------------------------------------------

export const DeleteWeeklyMenuSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu to delete. Get it from calories_get_weekly_menu.'),
});

export const deleteWeeklyMenuTool: ToolHandler<typeof DeleteWeeklyMenuSchema.shape> = async (input, context) => {
  const { userId } = context;

  const deleted = await deleteWeeklyMenu(userId, input.menuId);

  if (!deleted) {
    return toolResponse({ success: false, message: `Menu ${input.menuId} not found.` });
  }

  return toolResponse({
    success: true,
    message: `Deleted the weekly menu (${input.menuId}) and all of its meals.`,
  });
};

// ---------------------------------------------------------------------------
// Set prep / cooking notes
// ---------------------------------------------------------------------------

export const SetPrepNotesSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu. Get it from calories_get_weekly_menu.'),
  prepNotes: z
    .string()
    .describe(
      'Free-text prep & cooking notes for the week — batch-cooking / "cook once, eat twice" guidance the user reads ' +
        'in the hub, e.g. "Roast 1kg chicken Sunday → Mon lunch, Thu & Sun dinner." Pass an empty string to clear.',
    ),
});

export const setPrepNotesTool: ToolHandler<typeof SetPrepNotesSchema.shape> = async (input, context) => {
  const { userId } = context;

  const updated = await updateWeeklyMenu(userId, input.menuId, { notes: input.prepNotes.trim() || null });

  if (!updated) {
    return toolResponse({ success: false, message: `Menu ${input.menuId} not found.` });
  }

  return toolResponse({
    success: true,
    prepNotes: updated.notes,
    message: updated.notes
      ? 'Updated the prep notes. The user can see them under Calories → Weekly Menu.'
      : 'Cleared the prep notes for this menu.',
  });
};

// ---------------------------------------------------------------------------
// Set the shopping list
// ---------------------------------------------------------------------------

export const SetShoppingListSchema = z.object({
  menuId: z.string().describe('The menuId of the weekly menu. Get it from calories_get_weekly_menu.'),
  items: z
    .array(z.string())
    .describe(
      'The full shopping list for the week, one entry per line with quantities where useful, ' +
        'e.g. ["1kg chicken breast", "6 eggs", "500g oats"]. Aggregate ingredients across all planned meals. ' +
        'This REPLACES the existing list. Pass an empty array to clear it.',
    ),
});

export const setShoppingListTool: ToolHandler<typeof SetShoppingListSchema.shape> = async (input, context) => {
  const { userId } = context;

  const items = await replaceShoppingListItems(userId, input.menuId, input.items);

  if (items === null) {
    return toolResponse({ success: false, message: `Menu ${input.menuId} not found.` });
  }

  return toolResponse({
    success: true,
    itemCount: items.length,
    message:
      items.length > 0
        ? `Saved a shopping list of ${items.length} item${items.length === 1 ? '' : 's'}. The user can see it under Calories → Weekly Menu.`
        : 'Cleared the shopping list for this menu.',
  });
};
