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
  CreateWeeklyMenuSchema,
  createWeeklyMenuTool,
  GetWeeklyMenuSchema,
  getWeeklyMenuTool,
  SwapMealSchema,
  swapMealTool,
  AddMealSchema,
  addMealTool,
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
    name: 'calories_create_weekly_menu',
    description:
      'Create or replace a weekly meal plan for a specific week. ' +
      'Use this when the user asks you to plan meals for a week, create a menu, or suggest what to eat. ' +
      'IMPORTANT: Before calling this tool, follow these steps in order: ' +
      '1. Call calories_get_weekly_menu (without weekStart) to fetch the last few weeks of menus. ' +
      'Use this history to avoid repeating the same meals or ingredients — vary proteins, vegetables, and cuisines relative to recent weeks. ' +
      '2. Read the calories://profile resource (or call calories_get_daily_summary) ' +
      "to know the user's daily calorie target (min/max), macro goals (protein, carbs, fat), goal type (weight_loss, weight_gain, maintain), " +
      "and any dietary notes. Plan every day's meals to hit those targets. " +
      'If no profile is set, proceed with creating a balanced default menu anyway, ' +
      'but inform the user that no calorie goal is configured and their meals were not tailored to specific targets — ' +
      'suggest they set up their profile under Calories → Settings to get personalised menus in future. ' +
      'Plan all 7 days with breakfast, lunch, dinner, and snack. Include estimated calories and macros for each meal. ' +
      'The menu is saved to the hub and the user can view it under Calories → Weekly Menu. ' +
      'If a menu already exists for that week it will be replaced. ' +
      "The tool returns userTargets and any warnings if days exceed or fall below the user's calorie targets.",
    inputSchema: CreateWeeklyMenuSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: createWeeklyMenuTool,
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
    name: 'calories_add_meal',
    description:
      'Add a single meal to an existing weekly menu without replacing the whole week. ' +
      'Use this when the user wants to add a pre-workout, post-workout, or any extra meal to a specific day. ' +
      'Before calling: get the menuId by calling calories_get_weekly_menu with the weekStart. ' +
      'The slot must not already exist for that day — use calories_swap_meal to replace an existing meal instead.',
    inputSchema: AddMealSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: addMealTool,
  }),
  defineTool({
    name: 'calories_swap_meal',
    description:
      'Replace a single meal in an existing weekly menu with a new one. ' +
      'Use this when the user wants to swap one specific meal — e.g. "change my Thursday lunch" or "I don\'t feel like salmon tonight, give me something else". ' +
      'Before calling this tool: ' +
      '1. Call calories_get_weekly_menu with the weekStart to get the menuId and see the current meal. ' +
      "2. Generate a replacement that fits the same calorie slot and the user's dietary profile. " +
      '3. Call this tool with the new meal details. ' +
      'Only the specified meal slot is changed — all other days and meals remain untouched.',
    inputSchema: SwapMealSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: swapMealTool,
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
