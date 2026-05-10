import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { getUserActiveBudget, mergePayees } from '@my-hub/shared/services';

// ─── merge_payees ─────────────────────────────────────────────────────────────

export const MergePayeesSchema = z.object({
  targetId: z.number().int().positive().describe('The payee to merge everything into.'),
  sourceIds: z
    .array(z.number().int().positive())
    .min(1)
    .describe('Payee IDs to merge into targetId. All their transactions are reassigned, then they are deleted.'),
  canonicalName: z.string().min(1).optional().describe('Optional new name for the target payee after merge.'),
});

export const mergePayeesTool: ToolHandler<typeof MergePayeesSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new Error('No active budget. Set an active budget in the Hub first.');

  const result = await mergePayees(userId, budget.id, input.targetId, input.sourceIds, input.canonicalName);

  return toolResponse(result);
};
