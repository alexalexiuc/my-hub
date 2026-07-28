import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { measurementTypeDefinitions } from '@my-hub/shared/constants';
import { DeleteMealSchema, deleteMealTool, GetMealsSchema, getMealsTool, LogMealSchema, logMealTool } from './meals';
import { defineTool, toolResponse, wrapToolHandler } from '../../shared/toolsUtils';
import { UpdateProfileSchema, updateProfileTool } from './profile';
import { GetDailySummarySchema, getDailySummaryTool } from './summary';
import { GetHistorySchema, getHistoryTool } from './history';
import {
  DeleteMeasurementSchema,
  deleteMeasurementTool,
  GetMeasurementsSchema,
  getMeasurementsTool,
  LogMeasurementSchema,
  logMeasurementTool,
} from './measurement';
import {
  PlanWeekSchema,
  planWeekTool,
  GetWeeklyMenuSchema,
  getWeeklyMenuTool,
  SetMenuMealSchema,
  setMenuMealTool,
  RemoveMenuMealSchema,
  removeMenuMealTool,
  DeleteWeeklyMenuSchema,
  deleteWeeklyMenuTool,
  SetPrepNotesSchema,
  setPrepNotesTool,
  SetShoppingListSchema,
  setShoppingListTool,
} from './weekly-menu';

const caloriesTools = [
  // ---- Meal tools ----
  defineTool({
    name: 'calories_log_meal',
    description:
      'Log a meal and its calorie content. Use this after analyzing a food photo or when the user describes what they ate. The model should estimate calories and optionally macros before calling this tool. If the meal consists of multiple distinct foods (e.g. burger + fries), use the items array to log them all in a single call instead of calling this tool multiple times.',
    inputSchema: LogMealSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logMealTool,
  }),
  defineTool({
    name: 'calories_get_meals',
    description:
      'Retrieve individual meal entries with their mealIds, descriptions, calories, and macros. Use when you need to inspect or delete specific entries (mealId is required for deletion). For calorie summaries and trends, use calories_get_history or calories://today instead.',
    inputSchema: GetMealsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getMealsTool,
  }),
  defineTool({
    name: 'calories_delete_meal',
    description: 'Delete a meal entry by its mealId. Use this to correct a logging mistake.',
    inputSchema: DeleteMealSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteMealTool,
  }),
  // ---- Profile tools ----
  defineTool({
    name: 'calories_update_profile',
    description:
      'Save or update health profile (age, sex, height, activity level, goal) and daily targets (calorie bounds, macro targets). ' +
      'Computes BMR and TDEE via the Mifflin-St Jeor equation. ' +
      'IMPORTANT: Always ask the user what their goal is (weight_loss, weight_gain, or maintain) before calling this tool. ' +
      'For weight_loss or weight_gain, also ask for the weekly rate in kg. ' +
      'Height (heightCm) is stored on the profile and only needs to be set once. ' +
      'If the user specifies macros as percentages, convert them to grams using goalMaxCalories as the reference (protein & carbs = 4 kcal/g, fat = 9 kcal/g). ' +
      'Weight and other changing body measurements are logged separately via calories_log_measurement.',
    inputSchema: UpdateProfileSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: updateProfileTool,
  }),
  // ---- Summary tools ----
  defineTool({
    name: 'calories_get_daily_summary',
    description:
      'Get a full calorie and macro summary for a specific date, broken down by meal type. ' +
      'Shows progress against daily targets and whether the goal was met. ' +
      'Use this tool for a single date. For multi-day trends use calories_get_history.',
    inputSchema: GetDailySummarySchema.shape,
    annotations: { readOnlyHint: true },
    callback: getDailySummaryTool,
  }),
  defineTool({
    name: 'calories_get_history',
    description:
      'Get a calorie and weight history for a date range. Returns per-day calorie and macro totals, ' +
      'weight logs, period totals and averages vs goal. ' +
      'startDate and endDate both default to today when omitted. ' +
      'Use instead of the calories://history-7days and calories://history-30days resources when ' +
      'a custom date range is needed or when resources are not supported.',
    inputSchema: GetHistorySchema.shape,
    annotations: { readOnlyHint: true },
    callback: getHistoryTool,
  }),
  // ---- Measurement tools ----
  defineTool({
    name: 'calories_log_measurement',
    description:
      'Log a body measurement (weight, height, waist, etc.). Each entry is timestamped so you can track progress over time. Use calories_get_measurement_types to see available types.',
    inputSchema: LogMeasurementSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: logMeasurementTool,
  }),
  defineTool({
    name: 'calories_get_measurements',
    description:
      'Retrieve logged body measurements. Filter by type, date range, or get all. Useful for tracking progress.',
    inputSchema: GetMeasurementsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getMeasurementsTool,
  }),
  defineTool({
    name: 'calories_get_measurement_types',
    description: 'List all available measurement types with their units (weight in kg, height in cm, etc.)',
    annotations: { readOnlyHint: true },
    callback: async () => {
      return toolResponse(measurementTypeDefinitions.map(t => ({ key: t.key, label: t.label, unit: t.unit })));
    },
  }),
  defineTool({
    name: 'calories_delete_measurement',
    description: 'Delete a measurement entry by its ID.',
    inputSchema: DeleteMeasurementSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteMeasurementTool,
  }),
  // ---- Weekly menu tools ----
  defineTool({
    name: 'calories_plan_week',
    description:
      'Plan a full week of meals for a specific week, saving them as a weekly menu. ' +
      'Use this when the user asks you to plan meals for a week, create a menu, or suggest what to eat. ' +
      'IMPORTANT: Before calling this tool, follow these steps in order: ' +
      '1. Call calories_get_weekly_menu (without weekStart) to fetch the last few weeks of menus. ' +
      'Use this history to respect the meals the user clearly repeats (their staples). ' +
      'Absent such a signal — including the very first menu, when there is no history at all — plan for VARIETY by ' +
      'default: vary the dish across the week in every slot, and never put the same breakfast, lunch or dinner on all ' +
      'seven days. The user should have to ask for repetition, not for variety. ' +
      'The one thing that earns a repeat is batch cooking that genuinely saves work: cook one large batch and eat it ' +
      'on 2-3 days (e.g. roast 1 kg chicken on Sunday for Mon/Thu/Sun), and say so in prepNotes. Repeating a dish that ' +
      'needs no real prep (cereal, yoghurt, toast) saves nothing and only makes the week monotonous. ' +
      'Do not swing the other way either — 28 entirely different dishes is unrealistic to shop for and cook. ' +
      '2. Read the calories://profile resource (or call calories_get_daily_summary) ' +
      "to know the user's daily calorie target (min/max), macro goals (protein, carbs, fat), goal type (weight_loss, weight_gain, maintain), " +
      "and any dietary notes. Plan every day's meals to hit those targets. " +
      'If no profile is set, proceed with creating a balanced default menu anyway, ' +
      'but inform the user that no calorie goal is configured and their meals were not tailored to specific targets — ' +
      'suggest they set up their profile under Calories → Settings to get personalised menus in future. ' +
      'Plan all 7 days with breakfast, lunch, dinner, and snack. Include estimated calories and macros for each meal, ' +
      'plus per-meal ingredients for any dish that needs cooking. ' +
      '3. On gym days, shape the day around the profile\'s gymTime ("morning" | "midday" | "evening"): keep the meal ' +
      'before training lighter and carb-led so it digests in time, and make the meal after it the largest and most ' +
      'protein-heavy. Morning training makes breakfast the recovery meal (a small pre_workout snack before it, if any); ' +
      'evening training makes dinner the recovery meal and lunch the fuel. Add explicit pre_workout / post_workout ' +
      'meals only where they earn their place — do not add four extra slots a week for the sake of it. ' +
      'If gymDays are set but gymTime is null, ask the user when they train rather than guessing. ' +
      'In the SAME call, also provide prepNotes (batch-cooking / "cook once, eat twice" guidance) and a shoppingList ' +
      "(the same ingredients aggregated across the week with quantities — per-meal amounts stay on each meal's " +
      'ingredients field) so the whole week is planned in one go. ' +
      'The menu is saved to the hub and the user can view it under Calories → Weekly Menu. ' +
      'If a menu already exists for that week it will be replaced. ' +
      "The tool returns userTargets and any warnings if days exceed or fall below the user's calorie targets. " +
      'To adjust a single meal afterwards use calories_set_menu_meal; to update just the notes or shopping list use ' +
      'calories_set_prep_notes or calories_set_shopping_list — do not re-plan the whole week.',
    inputSchema: PlanWeekSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: planWeekTool,
  }),
  defineTool({
    name: 'calories_get_weekly_menu',
    description:
      'Retrieve a saved weekly meal plan. Pass weekStart (Monday YYYY-MM-DD) to get a specific week, or omit to list all saved menus.',
    inputSchema: GetWeeklyMenuSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getWeeklyMenuTool,
  }),
  defineTool({
    name: 'calories_set_menu_meal',
    description:
      'Set a single meal slot in an existing weekly menu — adds the meal if the slot is empty, or ' +
      'replaces the existing dish if that (day, mealType) slot is already filled. ' +
      'Use this whenever the user wants to change one specific meal without re-planning the whole week — ' +
      'e.g. "change my Thursday lunch", "I don\'t feel like salmon tonight, give me something else", or ' +
      'add a pre-workout / post-workout meal to a day. ' +
      'Before calling: ' +
      '1. Call calories_get_weekly_menu with the weekStart to get the menuId and see any current meal in that slot. ' +
      "2. Generate a dish that fits the same calorie slot and the user's dietary profile. " +
      '3. Call this tool with the meal details. ' +
      'Only the specified slot is affected — all other days and meals remain untouched. ' +
      'The whole slot is overwritten, so re-send ingredients and macros with every call — anything omitted is cleared. ' +
      "Swapping a dish does not update the week's shopping list; if the new ingredients change what the user needs " +
      'to buy, follow up with calories_set_shopping_list.',
    inputSchema: SetMenuMealSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: setMenuMealTool,
  }),
  defineTool({
    name: 'calories_remove_menu_meal',
    description:
      'Remove a single meal slot from an existing weekly menu without replacing the whole week. ' +
      'Use this when the user wants to drop a specific planned meal — e.g. "remove my Tuesday snack". ' +
      'Before calling: get the menuId by calling calories_get_weekly_menu with the weekStart. ' +
      'To replace a meal with a different one, use calories_set_menu_meal instead. ' +
      'To clear an entire week, use calories_delete_weekly_menu.',
    inputSchema: RemoveMenuMealSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: true },
    callback: removeMenuMealTool,
  }),
  defineTool({
    name: 'calories_delete_weekly_menu',
    description:
      'Delete an entire weekly meal plan and all of its meals. ' +
      "Use this when the user wants to clear or remove a whole week's menu. " +
      'Before calling: get the menuId by calling calories_get_weekly_menu (with or without weekStart). ' +
      'This cannot be undone. To replace a week with a new plan instead, use calories_plan_week (it overwrites ' +
      'any existing menu for that week). To remove just one meal, use calories_remove_menu_meal.',
    inputSchema: DeleteWeeklyMenuSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: true },
    callback: deleteWeeklyMenuTool,
  }),
  defineTool({
    name: 'calories_set_prep_notes',
    description:
      "Set or update the week's prep & cooking notes on an existing menu without re-planning the meals. " +
      'Use this for batch-cooking and "cook once, eat twice" guidance — e.g. "Roast 1kg chicken Sunday → ' +
      'Mon lunch, Thu & Sun dinner." Before calling, get the menuId from calories_get_weekly_menu. ' +
      'Pass an empty string to clear the notes.',
    inputSchema: SetPrepNotesSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: setPrepNotesTool,
  }),
  defineTool({
    name: 'calories_set_shopping_list',
    description:
      "Replace the week's shopping list on an existing menu with an AI-generated list — ingredients aggregated " +
      'across all planned meals, one entry per line with quantities where useful (e.g. "1kg chicken breast"). ' +
      'Use this when the user asks for a shopping list, or after editing the menu. Before calling, get the menuId ' +
      'from calories_get_weekly_menu. This overwrites the existing list; pass an empty array to clear it.',
    inputSchema: SetShoppingListSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: setShoppingListTool,
  }),
];

export function registerCaloriesTools(server: McpServer): void {
  for (const tool of caloriesTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      wrapToolHandler(tool.callback),
    );
  }
}
