import { z } from 'zod';
import { route, noContent } from '@/lib/api/route';
import { updatePlanItem, deletePlanItem } from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../../../../currency.schema';
import { monthlyPlanItemMutationSchema } from '../route';

const ParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  id: z.coerce.number(),
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
    return { item: serializeItem(await updatePlanItem(user.id, params.id, body)) };
  },
);

export const DELETE = route({ params: ParamsSchema })(async ({ user, params }) => {
  await deletePlanItem(user.id, params.id);
  return noContent();
});
