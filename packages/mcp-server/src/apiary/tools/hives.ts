import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiaryHives, createApiaryHive, updateApiaryHive, getApiaryHiveStatus } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const CreateHiveSchema = z.object({
  name: z.string().min(1).describe('Name of the hive (e.g. "Hive #3", "Blue Hive")'),
  yard_id: z.number().int().positive().optional().describe('ID of the yard this hive belongs to'),
  queen_status: z.string().optional().describe('Queen status (e.g. "queenright", "queenless", "requeened")'),
  queen_marked: z.boolean().optional().describe('Whether the queen is marked'),
  queen_year: z.number().int().optional().describe('Year the queen was introduced'),
  boxes: z.number().int().positive().optional().describe('Number of boxes/supers'),
  notes: z.string().optional().describe('Optional notes about this hive'),
});

export const ListHivesSchema = z.object({
  yard_id: z.number().int().positive().optional().describe('Filter by yard ID'),
  active: z.boolean().optional().describe('Filter by active status'),
});

export const UpdateHiveSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive to update'),
  name: z.string().min(1).optional().describe('New name for the hive'),
  yard_id: z.number().int().positive().optional().describe('New yard assignment'),
  queen_status: z.string().optional().describe('Updated queen status'),
  queen_marked: z.boolean().optional().describe('Whether the queen is marked'),
  queen_year: z.number().int().optional().describe('Year the queen was introduced'),
  boxes: z.number().int().positive().optional().describe('Updated number of boxes'),
  notes: z.string().optional().describe('Updated notes'),
  is_active: z.boolean().optional().describe('Whether the hive is active'),
});

export const GetHiveStatusSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive to get full status for'),
});

export const createHiveTool: ToolCallback<typeof CreateHiveSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const hive = await createApiaryHive(userId, {
    name: input.name,
    ...omitNullish({
      yardId: input.yard_id,
      queenStatus: input.queen_status,
      queenMarked: input.queen_marked,
      queenYear: input.queen_year,
      boxes: input.boxes,
      notes: input.notes,
    }),
  });
  return toolResponse(hive);
};

export const listHivesTool: ToolCallback<typeof ListHivesSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const hives = await getApiaryHives(userId, omitNullish({ yardId: input.yard_id, active: input.active }));
  return toolResponse({ hives, count: hives.length });
};

export const updateHiveTool: ToolCallback<typeof UpdateHiveSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const hive = await updateApiaryHive(
    userId,
    input.hive_id,
    omitNullish({
      name: input.name,
      yardId: input.yard_id,
      queenStatus: input.queen_status,
      queenMarked: input.queen_marked,
      queenYear: input.queen_year,
      boxes: input.boxes,
      notes: input.notes,
      isActive: input.is_active,
    }),
  );
  if (!hive) throw new Error(`Hive with id ${input.hive_id} not found`);
  return toolResponse(hive);
};

export const getHiveStatusTool: ToolCallback<typeof GetHiveStatusSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const status = await getApiaryHiveStatus(userId, input.hive_id);
  if (!status) throw new Error(`Hive with id ${input.hive_id} not found`);
  return toolResponse(status);
};
