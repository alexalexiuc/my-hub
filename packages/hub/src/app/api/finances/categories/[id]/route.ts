import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  updateCategory,
  deleteCategory,
  archiveCategory,
  countTransactions,
} from '@my-hub/shared/services';
import type { CategoryIcon } from '@my-hub/shared/constants';
import { CategoryIcons } from '@my-hub/shared/constants';
import { trimOrNull } from '@my-hub/shared/utils';
import { categoryMutationResponseSchema } from '../route';
import type { CategoryMutationResponse } from '../route';

export const categoryUpdateBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').optional(),
  icon: z
    .enum(Object.values(CategoryIcons) as [string, ...string[]])
    .nullable()
    .optional(),
  color: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  monthlyTarget: z.number().nonnegative().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type CategoryUpdateBody = z.infer<typeof categoryUpdateBodySchema>;
export type { CategoryMutationResponse };

const deleteResponseSchema = z.object({ id: z.number(), action: z.enum(['deleted', 'archived']) });
export type CategoryDeleteResponse = z.infer<typeof deleteResponseSchema>;

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const PATCH = route({
  body: categoryUpdateBodySchema,
  params: IdParamSchema,
  response: categoryMutationResponseSchema,
})(async ({ user, body, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const category = await updateCategory(user.id, budget.id, params.id, {
    name: body.name,
    icon: body.icon !== undefined ? ((body.icon as CategoryIcon | null) ?? null) : undefined,
    color: body.color,
    notes: trimOrNull(body.notes),
    monthlyTarget: body.monthlyTarget,
    groupId: body.groupId,
    sortOrder: body.sortOrder,
  });

  return category;
});

export const DELETE = route({ params: IdParamSchema, response: deleteResponseSchema })(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const txCount = await countTransactions(user.id, budget.id, { categoryId: params.id });

  if (txCount > 0) {
    await archiveCategory(user.id, budget.id, params.id);
    return { id: params.id, action: 'archived' as const };
  }

  await deleteCategory(user.id, budget.id, params.id);
  return { id: params.id, action: 'deleted' as const };
});
