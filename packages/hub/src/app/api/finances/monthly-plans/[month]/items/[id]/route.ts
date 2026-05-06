import { z } from 'zod';
import { route, routeHttpError, noContent } from '@/lib/api/route';
import { getUserActiveBudget, updatePlanItem, deletePlanItem, togglePlanItemAssigned } from '@my-hub/shared/services';
import { monthlyPlanItemMutationSchema } from '../../../../contracts';
import { supportedCurrencySchema } from '../../../../currency.schema';

const ParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  id: z.string(),
});

const ItemUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().optional(),
  currency: supportedCurrencySchema.optional(),
  categoryId: z.number().int().nullable().optional(),
  merchantId: z.number().int().nullable().optional(),
  linkedAccountId: z.number().int().nullable().optional(),
  assignedAmount: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  isAssigned: z.boolean().optional(),
});

function serializeItem(item: Awaited<ReturnType<typeof updatePlanItem>>) {
  return {
    ...item,
    categoryName: null,
    merchantName: null,
    linkedAccountName: null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export const PATCH = route({ params: ParamsSchema, body: ItemUpdateSchema, response: monthlyPlanItemMutationSchema })(
  async ({ user, params, body }) => {
    const budget = await getUserActiveBudget(user.id);
    if (!budget) routeHttpError(404, { error: 'No budget found' });

    const itemId = parseInt(params.id, 10);
    if (isNaN(itemId)) routeHttpError(400, { error: 'Invalid item id' });

    if (body.isAssigned !== undefined) {
      const item = await togglePlanItemAssigned(user.id, budget.id, itemId, body.isAssigned);
      return { item: serializeItem(item) };
    }

    const { isAssigned: _dropped, ...rest } = body;
    const item = await updatePlanItem(user.id, budget.id, itemId, rest);
    return { item: serializeItem(item) };
  },
);

export const DELETE = route({ params: ParamsSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const itemId = parseInt(params.id, 10);
  if (isNaN(itemId)) routeHttpError(400, { error: 'Invalid item id' });

  await deletePlanItem(user.id, budget.id, itemId);
  return noContent();
});
