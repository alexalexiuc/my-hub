import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getUserActiveBudget, getMonthlyPlanFull, addPlanItem } from '@my-hub/shared/services';
import { monthlyPlanItemMutationSchema } from '../../../contracts';
import { supportedCurrencySchema } from '../../../currency.schema';

const ParamsSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

const ItemCreateSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  currency: supportedCurrencySchema,
  categoryId: z.number().int().nullable().optional(),
  merchantId: z.number().int().nullable().optional(),
  linkedAccountId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

export const POST = route({ params: ParamsSchema, body: ItemCreateSchema, response: monthlyPlanItemMutationSchema })(
  async ({ user, params, body }) => {
    const budget = await getUserActiveBudget(user.id);
    if (!budget) routeHttpError(404, { error: 'No budget found' });

    const full = await getMonthlyPlanFull(user.id, budget.id, params.month);
    const item = await addPlanItem(user.id, full.plan.id, {
      name: body.name,
      amount: body.amount,
      currency: body.currency,
      categoryId: body.categoryId ?? null,
      merchantId: body.merchantId ?? null,
      linkedAccountId: body.linkedAccountId ?? null,
      sortOrder: body.sortOrder ?? 0,
      notes: body.notes ?? null,
    });

    return created({
      item: {
        ...item,
        categoryName: null,
        merchantName: null,
        linkedAccountName: null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  },
);
