import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { upsertCalorieProfile, getCalorieProfile } from '@my-hub/shared/services';
import z from 'zod';
import { toolResponse } from '../../shared/toolsUtils';

export const UpdateMacrosSchema = z.object({
  goal_protein_g: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Daily protein target in grams (e.g. 150). Pass null to clear.'),
  goal_carbs_g: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Daily carbohydrate target in grams (e.g. 250). Pass null to clear.'),
  goal_fat_g: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Daily fat target in grams (e.g. 80). Pass null to clear.'),
  goal_min_calories: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Minimum daily calorie floor. Pass null to clear.'),
  goal_max_calories: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe(
      'Maximum daily calorie ceiling. Required as a reference when setting macros by percentage. Pass null to clear.',
    ),
});

export const updateMacrosTool: ToolCallback<typeof UpdateMacrosSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  const updates: Record<string, unknown> = {};
  if (input.goal_protein_g !== undefined) updates['goalProtein'] = input.goal_protein_g;
  if (input.goal_carbs_g !== undefined) updates['goalCarbs'] = input.goal_carbs_g;
  if (input.goal_fat_g !== undefined) updates['goalFat'] = input.goal_fat_g;
  if (input.goal_min_calories !== undefined) updates['goalMinCalories'] = input.goal_min_calories;
  if (input.goal_max_calories !== undefined) updates['goalMaxCalories'] = input.goal_max_calories;

  await upsertCalorieProfile(userId, updates);

  const profile = await getCalorieProfile(userId);

  const proteinKcal = (profile?.goalProtein ?? 0) * 4;
  const carbsKcal = (profile?.goalCarbs ?? 0) * 4;
  const fatKcal = (profile?.goalFat ?? 0) * 4;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;
  const maxCal = profile?.goalMaxCalories ?? null;

  return toolResponse({
    goal_protein_g: profile?.goalProtein ?? null,
    goal_carbs_g: profile?.goalCarbs ?? null,
    goal_fat_g: profile?.goalFat ?? null,
    goal_min_calories: profile?.goalMinCalories ?? null,
    goal_max_calories: maxCal,
    macro_kcal: {
      protein: proteinKcal,
      carbs: carbsKcal,
      fat: fatKcal,
      total: totalMacroKcal,
      pct_of_max: maxCal ? Math.round((totalMacroKcal / maxCal) * 100) : null,
    },
  });
};
