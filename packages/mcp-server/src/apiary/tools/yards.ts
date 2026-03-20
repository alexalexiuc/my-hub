import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiaryYards, createApiaryYard, updateApiaryYard } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const CreateYardSchema = z.object({
  name: z.string().min(1).describe('Name of the yard (e.g. "Home Yard", "Mountain Apiary")'),
  location: z.string().optional().describe('Address or GPS coordinates'),
  notes: z.string().optional().describe('Optional notes about this yard'),
});

export const ListYardsSchema = z.object({});

export const UpdateYardSchema = z.object({
  yard_id: z.number().int().positive().describe('ID of the yard to update'),
  name: z.string().min(1).optional().describe('New name for the yard'),
  location: z.string().optional().describe('New location'),
  notes: z.string().optional().describe('Updated notes'),
  is_active: z.boolean().optional().describe('Whether the yard is active'),
});

export const createYardTool: ToolCallback<typeof CreateYardSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const yard = await createApiaryYard(userId, {
    name: input.name,
    ...omitNullish({ location: input.location, notes: input.notes }),
  });
  return toolResponse(yard);
};

export const listYardsTool: ToolCallback<typeof ListYardsSchema.shape> = async (_input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const yards = await getApiaryYards(userId);
  return toolResponse({ yards, count: yards.length });
};

export const updateYardTool: ToolCallback<typeof UpdateYardSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const yard = await updateApiaryYard(
    userId,
    input.yard_id,
    omitNullish({ name: input.name, location: input.location, notes: input.notes, isActive: input.is_active }),
  );
  if (!yard) throw new Error(`Yard with id ${input.yard_id} not found`);
  return toolResponse(yard);
};
