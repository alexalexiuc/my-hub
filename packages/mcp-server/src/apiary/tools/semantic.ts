import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiaryActiveTreatments, getApiaryOverdueInspections } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const GetActiveTreatmentsSchema = z.object({
  hive_id: z.number().int().positive().optional().describe('Filter by hive ID. Omit for all hives.'),
});

export const GetOverdueInspectionsSchema = z.object({
  threshold_days: z
    .number()
    .int()
    .positive()
    .default(14)
    .optional()
    .describe('Number of days since last inspection to consider overdue (default: 14)'),
});

export const getActiveTreatmentsTool: ToolCallback<typeof GetActiveTreatmentsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const treatments = await getApiaryActiveTreatments(userId, omitNullish({ hiveId: input.hive_id }));
  return toolResponse({ treatments, count: treatments.length });
};

export const getOverdueInspectionsTool: ToolCallback<typeof GetOverdueInspectionsSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const overdue = await getApiaryOverdueInspections(userId, omitNullish({ thresholdDays: input.threshold_days }));
  return toolResponse({ hives: overdue, count: overdue.length });
};
