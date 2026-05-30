import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { getUserActiveBudget, getLabels } from '@my-hub/shared/services';
import Fuse from 'fuse.js';

// ─── list_labels ─────────────────────────────────────────────────────────────

export const ListLabelsSchema = z.object({
  search: z
    .string()
    .optional()
    .describe('Optional fuzzy search term. Filters labels by approximate match against the label string.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .default(100)
    .describe('Maximum number of labels to return (default 100, max 500).'),
  offset: z.number().int().min(0).default(0).describe('Number of labels to skip for pagination (default 0).'),
});

export const listLabelsTool: ToolHandler<typeof ListLabelsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const all = await getLabels(userId, budget.id);

  const filtered = input.search ? new Fuse(all, { threshold: 0.3 }).search(input.search).map(r => r.item) : all;

  const page = filtered.slice(input.offset, input.offset + input.limit);

  return toolResponse({ labels: page, total: filtered.length, limit: input.limit, offset: input.offset });
};
