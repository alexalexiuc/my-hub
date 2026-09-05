import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { omitUndefined } from '@my-hub/shared/utils';
import {
  getBudgetMembers,
  updateBudget,
  deleteBudget,
  removeBudgetMember,
  getUserActiveBudget,
} from '@my-hub/shared/services';
import { supportedCurrencySchema } from '../currency.schema';
import { okResponseSchema } from '../shared.schema';
import { budgetInfoSchema, budgetMemberSchema } from './budget.schema';
export type { BudgetInfo, BudgetMember } from './budget.schema';

export const budgetDetailResponseSchema = z.object({
  budget: budgetInfoSchema,
  members: z.array(budgetMemberSchema),
});

export const budgetMutationResponseSchema = z.object({
  budget: budgetInfoSchema,
});

export type BudgetDetailResponse = z.infer<typeof budgetDetailResponseSchema>;
export type BudgetMutationResponse = z.infer<typeof budgetMutationResponseSchema>;

const BudgetUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  defaultCurrency: supportedCurrencySchema.optional(),
  amountsHidden: z.boolean().optional(),
});

/**
 * Strict, and the id must be non-empty: an unrecognised or blank `removeMemberUserId` would
 * otherwise be stripped or read as falsy, and DELETE falls through to deleting the whole budget.
 * A typo in a member-removal request has to fail, not escalate.
 */
const BudgetDeleteSchema = z
  .object({
    removeMemberUserId: z.string().min(1).optional(),
  })
  .strict();

export const GET = route({ response: budgetDetailResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const members = await getBudgetMembers(user.id, budget.id);

  return {
    budget: {
      id: budget.id,
      name: budget.name,
      defaultCurrency: budget.defaultCurrency,
      amountsHidden: budget.amountsHidden,
      createdByUserId: budget.createdByUserId,
      isOwner: budget.createdByUserId === user.id,
    },
    members: members.map(m => ({ userId: m.userId, email: m.email, name: m.name, joinedAt: m.joinedAt.toISOString() })),
  };
});

export const PATCH = route({ body: BudgetUpdateSchema, response: budgetMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const updated = await updateBudget(
    user.id,
    budget.id,
    omitUndefined({
      name: body.name?.trim(),
      defaultCurrency: body.defaultCurrency,
      amountsHidden: body.amountsHidden,
    }),
  );

  return { budget: { ...updated, isOwner: updated.createdByUserId === user.id } };
});

// An empty body is the request here: no `removeMemberUserId` means "delete the budget itself".
export const DELETE = route({ body: BudgetDeleteSchema, response: okResponseSchema, allowEmptyBody: true })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  if (body.removeMemberUserId) {
    await removeBudgetMember(user.id, budget.id, body.removeMemberUserId);
    return { ok: true };
  }

  await deleteBudget(user.id, budget.id);
  return { ok: true };
});
