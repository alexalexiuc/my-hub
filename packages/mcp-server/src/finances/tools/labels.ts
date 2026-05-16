import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { getUserActiveBudget, getLabels } from '@my-hub/shared/services';

export const ListLabelsSchema = z.object({});

export const listLabelsTool: ToolHandler<typeof ListLabelsSchema.shape> = async (_input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const labels = await getLabels(userId, budget.id);
  return toolResponse({ labels });
};
