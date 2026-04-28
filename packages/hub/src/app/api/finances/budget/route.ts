import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getBudgetMembers,
  updateBudget,
  deleteBudget,
  removeBudgetMember,
  getUserActiveBudget,
} from '@my-hub/shared/services';
import { budgetDetailResponseSchema, budgetMutationResponseSchema, okResponseSchema } from '../contracts';
const BudgetUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  defaultCurrency: z.string().trim().optional(),
});

const BudgetDeleteSchema = z.object({
  removeMemberUserId: z.string().optional(),
});

export const GET = route({ response: budgetDetailResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const members = await getBudgetMembers(user.id, budget.id);

  return {
    budget: {
      id: budget.id,
      name: budget.name,
      defaultCurrency: budget.defaultCurrency,
      createdByUserId: budget.createdByUserId,
      isOwner: budget.createdByUserId === user.id,
    },
    members: members.map(m => ({ userId: m.userId, email: m.email, name: m.name, joinedAt: m.joinedAt })),
  };
});

export const PATCH = route({ body: BudgetUpdateSchema, response: budgetMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const updated = await updateBudget(user.id, budget.id, {
    ...(body.name ? { name: body.name.trim() } : {}),
    ...(body.defaultCurrency ? { defaultCurrency: body.defaultCurrency.trim().toUpperCase() } : {}),
  });

  return { budget: updated };
});

export const DELETE = route({ body: BudgetDeleteSchema, response: okResponseSchema })(async ({ user, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  if (body.removeMemberUserId) {
    await removeBudgetMember(user.id, budget.id, body.removeMemberUserId);
    return { ok: true };
  }

  await deleteBudget(user.id, budget.id);
  return { ok: true };
});
