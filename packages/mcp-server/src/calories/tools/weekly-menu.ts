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
import {
  localDateString,
  startOfWeekMonday,
  dateToString,
  dayOfWeekMon0,
  hasDuplicateMealSlot,
  logger,
} from '@my-hub/shared/utils';

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
    .enum(DaysOfWeek)
    .describe('Day of week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday'),
  mealType: mealTypeSchema,
  description: z.string().describe('What to eat, e.g. "Grilled salmon with quinoa and broccoli"'),
  ingredients: z
    .array(z.string())
    .optional()
    .describe(
      'What goes into this dish, one entry per line with quantities, e.g. ["180g salmon fillet", "80g quinoa", ' +
        '"150g broccoli", "1 tbsp olive oil"]. Per-portion amounts for this meal only — do not aggregate across ' +
        'the week (that is what shoppingList is for). Optional, but include it whenever the dish needs cooking so ' +
        'the user can shop and cook from the menu itself.',
    ),
  kcal: z.number().int().positive().optional().describe('Estimated calories'),
  protein: z.number().positive().optional().describe('Protein in grams'),
  carbs: z.number().positive().optional().describe('Carbohydrates in grams'),
  fat: z.number().positive().optional().describe('Fat in grams'),
});

const menuIdSchema = z.string().describe('The menuId of the weekly menu. Get it from calories_get_weekly_menu.');

// The model reads these descriptions, so the plan-the-week and update-one-field tools must
// describe the same field the same way. Only the trailing "how this call treats it" differs.
const PREP_NOTES_DESC =
  'Actionable prep and batch-cooking instructions for the week. Cover: what to cook in advance, when to ' +
  'prep it, and how it maps to specific meals (cook-once, eat-twice). Be specific about quantities and ' +
  'timing. Example: "Sunday: roast 1 kg chicken breast → Mon lunch + Thu/Sun dinner. Cook 500 g rice. ' +
  'Wed: hard-boil 6 eggs. Each morning: portion overnight oats from Sunday batch." No motivational text.';

const SHOPPING_LIST_DESC =
  'The shopping list for the week, one entry per line with quantities where useful, e.g. ' +
  '["1kg chicken breast", "6 eggs", "500g oats", "2 avocados"]. Aggregate ingredients across all planned ' +
  'meals so the user can shop once.';

export const PlanWeekSchema = z.object({
  weekStart: yyyyMmDdSchema.describe(
    'The Monday of the target week in YYYY-MM-DD format. Use the upcoming Monday for "next week", or the current Monday for "this week".',
  ),
  title: z.string().optional().describe('Optional menu title, e.g. "High protein week"'),
  prepNotes: z.string().optional().describe(`${PREP_NOTES_DESC} Optional.`),
  shoppingList: z
    .array(z.string())
    .optional()
    .describe(`${SHOPPING_LIST_DESC} Optional. Replaces any existing list for the week.`),
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

  // Gym days from profile — used to label training vs rest days in the response. Everything here
  // reads off `profile`, never `profileRow`: rowToProfile already resolves the bonus against its
  // default, and going around it is how the tool's warning math drifts from the profile resource.
  // The `??` below only covers the no-profile-row case, where `profile` is an empty object.
  const gymDays = profile.gymDays ?? [];
  const gymDayCalorieBonus = profile.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS;
  // Which meals fall either side of training — drives pre_workout / post_workout placement.
  const gymTime = profile.gymTime ?? null;

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

  // Meals, prep notes and the shopping list are written as one unit, so the whole
  // week either lands or it doesn't.
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
        ingredients: m.ingredients ?? null,
        kcal: m.kcal ?? null,
        protein: m.protein ?? null,
        carbs: m.carbs ?? null,
        fat: m.fat ?? null,
      })),
      shoppingList: input.shoppingList,
    });
  } catch (err) {
    logger.error(`[calories] planWeek failed for user ${userId}, week ${input.weekStart}:`, err);
    return toolResponse({
      success: false,
      message: `Could not save the weekly menu for ${input.weekStart}. Please try again.`,
    });
  }

  return toolResponse({
    menuId: menu.menuId,
    weekStart: menu.weekStart,
    title: menu.title,
    totalMeals: menu.meals.length,
    prepNotes: menu.notes,
    shoppingListItems: menu.shoppingList.length,
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
            protein: profile.goalProtein ?? null,
            carbs: profile.goalCarbs ?? null,
            fat: profile.goalFat ?? null,
          },
          gymDays: gymDays.length > 0 ? gymDays : null,
          gymDayCalorieBonus,
          gymTime,
        }
      : null,
    warnings: warnings.length > 0 ? warnings : null,
    message: !profileRow
      ? `Weekly menu saved for ${menu.weekStart} as a balanced default — no calorie profile is set so meals were not tailored to specific targets. Suggest the user sets up their profile under Calories → Settings.`
      : `Weekly menu saved for ${menu.weekStart}. The user can view it in the hub under Calories → Weekly Menu.${isCurrentWeek && planFromDayOfWeek > 0 ? ` Only planned from ${DAY_LABELS_SHORT[planFromDayOfWeek]} (today) onwards — past days were skipped.` : ''}${gymDays.length > 0 ? ` Gym days (${gymDays.map(d => DAY_LABELS_SHORT[d]).join(', ')}) have been taken into account — plan higher calories/carbs on those days.${gymTime ? ` Training happens in the ${gymTime}, so place the lighter pre-workout and the recovery meal accordingly.` : ' No training time is set — ask the user when they train so pre/post-workout meals can be placed.'}` : ''}${warnings.length > 0 ? " Note: some days exceed the user's calorie targets — consider revising." : ''}`,
  });
};

export const getWeeklyMenuTool: ToolHandler<typeof GetWeeklyMenuSchema.shape> = async (input, context) => {
  const { userId } = context;

  const [profileRow, menuResult] = await Promise.all([
    getCalorieProfile(userId),
    input.weekStart ? getWeeklyMenuByWeek(userId, input.weekStart) : getWeeklyMenus(userId),
  ]);
  const profile = profileRow ? rowToProfile(profileRow) : null;
  const gymDaysOrNull = profile?.gymDays?.length ? profile.gymDays : null;
  const gymTime = profile?.gymTime ?? null;

  if (input.weekStart) {
    if (!menuResult) return toolResponse({ menu: null, message: `No menu found for week of ${input.weekStart}.` });
    return toolResponse({ menu: menuResult, gymDays: gymDaysOrNull, gymTime });
  }

  return toolResponse({ menus: menuResult, gymDays: gymDaysOrNull, gymTime });
};

// ---------------------------------------------------------------------------
// Set (add or swap) a single meal
// ---------------------------------------------------------------------------

export const SetMenuMealSchema = MenuMealSchema.extend({ menuId: menuIdSchema });

export const setMenuMealTool: ToolHandler<typeof SetMenuMealSchema.shape> = async (input, context) => {
  const { userId } = context;

  const meal = await upsertMenuMeal(userId, input.menuId, {
    dayOfWeek: input.dayOfWeek,
    mealType: input.mealType,
    description: input.description,
    ingredients: input.ingredients ?? null,
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

export const RemoveMenuMealSchema = MenuMealSchema.pick({ dayOfWeek: true, mealType: true }).extend({
  menuId: menuIdSchema,
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
  menuId: menuIdSchema,
  prepNotes: z.string().describe(`${PREP_NOTES_DESC} Pass an empty string to clear.`),
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
  menuId: menuIdSchema,
  items: z
    .array(z.string())
    .describe(`${SHOPPING_LIST_DESC} REPLACES the existing list. Pass an empty array to clear.`),
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
