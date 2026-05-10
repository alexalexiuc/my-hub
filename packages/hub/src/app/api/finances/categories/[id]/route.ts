import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  updateCategory,
  deleteCategory,
  archiveCategory,
  countTransactions,
} from '@my-hub/shared/services';
import { CategoryIcons } from '@my-hub/shared/constants';
import type { CategoryIcon } from '@my-hub/shared/constants';
import { categoryMutationResponseSchema } from '../../contracts';

const CategoryUpdateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').optional(),
  icon: z
    .enum(Object.values(CategoryIcons) as [string, ...string[]])
    .nullable()
    .optional(),
  color: z.string().nullable().optional(),
  monthlyTarget: z.number().nonnegative().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const PATCH = route({
  body: CategoryUpdateSchema,
  params: IdParamSchema,
  response: categoryMutationResponseSchema,
})(async ({ user, body, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const category = await updateCategory(user.id, budget.id, params.id, {
    name: body.name,
    icon: body.icon !== undefined ? ((body.icon as CategoryIcon | null) ?? null) : undefined,
    color: body.color !== undefined ? body.color : undefined,
    monthlyTarget: body.monthlyTarget !== undefined ? body.monthlyTarget : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
    groupId: body.groupId !== undefined ? body.groupId : undefined,
    sortOrder: body.sortOrder,
  });

  return category;
});

const deleteResponseSchema = z.object({ id: z.number(), action: z.enum(['deleted', 'archived']) });

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
