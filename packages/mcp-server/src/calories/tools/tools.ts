import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMeasurementTypes } from '@my-hub/shared/services';
import { DeleteMealSchema, deleteMealTool, GetMealsSchema, getMealsTool, LogMealSchema, logMealTool } from './meals';
import { defineTool, toolResponse, withUserIdCheck } from '../../shared/toolsUtils';
import { UpdateProfileSchema, updateProfileTool } from './profile';
import { GetDailySummarySchema, getDailySummaryTool } from './summary';
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
      'Retrieve logged meal entries. Filter by date or meal type. Useful for reviewing what was eaten on a given day.',
    inputSchema: GetMealsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getMealsTool,
  }),
  defineTool({
    name: 'calories_delete_meal',
    description: 'Delete a meal entry by its meal_id. Use this to correct a logging mistake.',
    inputSchema: DeleteMealSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteMealTool,
  }),
  // ---- Profile tools ----
  defineTool({
    name: 'calories_update_profile',
    description:
      'Save or update health profile (age, sex, height, activity level, and goal). ' +
      'Computes BMR and TDEE via the Mifflin-St Jeor equation. ' +
      'IMPORTANT: Always ask the user what their goal is (weight_loss, weight_gain, or maintain) before calling this tool. ' +
      'For weight_loss or weight_gain, also ask for the weekly rate in kg. ' +
      'Height (height_cm) is stored on the profile and only needs to be set once. ' +
      'Weight and other changing body measurements are logged separately via calories_log_measurement.',
    inputSchema: UpdateProfileSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: updateProfileTool,
  }),
  // ---- Summary tools ----
  defineTool({
    name: 'calories_get_daily_summary',
    description:
      'Get a full calorie and macro summary for a specific past or custom date, broken down by meal type. ' +
      'Shows progress against daily targets and whether the goal was met. ' +
      "For today's summary, always use the calories://today resource instead — it is faster and always up to date. " +
      'Use this tool only for past or specific dates (e.g. "what did I eat last Monday?").',
    inputSchema: GetDailySummarySchema.shape,
    annotations: { readOnlyHint: true },
    callback: getDailySummaryTool,
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
    skipUserIdCheck: true,
    callback: async () => {
      const types = await getMeasurementTypes();
      return toolResponse(types.map((t) => ({ key: t.key, label: t.label, unit: t.unit })));
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
      withUserIdCheck(tool.callback, tool.skipUserIdCheck),
    );
  }
}
