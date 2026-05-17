import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { getUserActiveBudget, getMonthlyPlanFull } from '@my-hub/shared/services';
import { HandledError } from '../../shared/errors';

export const GetMonthlyPlanSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe('Month to fetch in YYYY-MM format.'),
});

export const getMonthlyPlanTool: ToolHandler<typeof GetMonthlyPlanSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const full = await getMonthlyPlanFull(userId, budget.id, input.month, false);
  if (!full) {
    return toolResponse({ month: input.month, exists: false });
  }

  return toolResponse({
    month: input.month,
    exists: true,
    currency: full.currency,
    plan: {
      id: full.plan.id,
      availableAmount: full.plan.availableAmount,
      incomeAccountId: full.plan.incomeAccountId,
    },
    summary: full.summary,
    items: full.items.map(item => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      assignedAmount: item.assignedAmount,
      isAssigned: item.isAssigned,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      merchantId: item.merchantId,
      merchantName: item.merchantName,
      linkedAccountId: item.linkedAccountId,
      linkedAccountName: item.linkedAccountName,
      notes: item.notes,
      sortOrder: item.sortOrder,
    })),
  });
};
