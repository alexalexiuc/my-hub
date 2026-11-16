import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  closeDeposit,
  getAccountById,
  getDepositSummaryForAccount,
  getUserActiveBudget,
  recordDepositInterest,
} from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import { depositActionSchema, depositSummarySchema } from '../../../deposit.schema';

const depositActionResponseSchema = z.object({
  accountId: z.number().int(),
  depositSummary: depositSummarySchema.nullable(),
  /** recordInterest: net/tax/gross recorded. close: amount returned to the return account. */
  net: z.number().optional(),
  tax: z.number().optional(),
  gross: z.number().optional(),
  returnedAmount: z.number().optional(),
});

export type DepositActionBody = z.infer<typeof depositActionSchema>;
export type DepositActionResponse = z.infer<typeof depositActionResponseSchema>;

/** Deposit lifecycle actions: log an interest payout, or close the deposit (matured / broken early). */
export const POST = route({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: depositActionSchema,
  response: depositActionResponseSchema,
})(async ({ user, params, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const account = await getAccountById(user.id, budget.id, params.id);
  if (!account) routeHttpError(404, { error: 'Account not found' });
  if (account.type !== AccountTypes.Deposit) routeHttpError(400, { error: 'Not a deposit account' });

  if (body.action === 'recordInterest') {
    const { action: _action, ...input } = body;
    const { net, tax, gross } = await recordDepositInterest(user.id, budget.id, account.id, input);
    return {
      accountId: account.id,
      net,
      tax,
      gross,
      depositSummary: await getDepositSummaryForAccount(user.id, budget.id, account),
    };
  }

  const { action: _action, ...input } = body;
  const { account: closed, returnedAmount } = await closeDeposit(user.id, budget.id, account.id, input);
  return {
    accountId: closed.id,
    returnedAmount,
    depositSummary: await getDepositSummaryForAccount(user.id, budget.id, closed),
  };
});
