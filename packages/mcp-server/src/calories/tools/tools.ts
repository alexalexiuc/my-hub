import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMeasurementTypes } from '@my-hub/shared/services';
import { DeleteMealSchema, deleteMealTool, GetMealsSchema, getMealsTool, LogMealSchema, logMealTool } from './meals';
import { defineTool, toolResponse, withUserIdCheck } from '../../shared/toolsUtils';
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
      const types = await getMeasurementTypes();
      return toolResponse(types.map(t => ({ key: t.key, label: t.label, unit: t.unit })));
    },
  }),
  defineTool({
    name: 'calories_delete_measurement',
    description: 'Delete a measurement entry by its ID.',
    inputSchema: DeleteMeasurementSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteMeasurementTool,
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
      withUserIdCheck(tool.callback),
    );
  }
}
