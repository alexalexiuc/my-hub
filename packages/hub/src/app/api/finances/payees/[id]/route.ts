import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getPayeeSummary, updatePayee } from '@my-hub/shared/services';
import { trimOrNull } from '@my-hub/shared/utils';
import { payeeWithSuggestionSchema } from '../route';
import { supportedCurrencySchema } from '../../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../../shared.schema';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

const PayeeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').optional(),
  aliases: z.array(z.string().trim()).optional(),
  description: z.string().trim().nullable().optional(),
});

export const payeeSummaryResponseSchema = z.object({
  txCount: z.number().int(),
  totalSpent: z.number(),
  totalIncome: z.number(),
  avgSpent: z.number().nullable(),
  firstDate: z.string().nullable(),
  lastDate: z.string().nullable(),
  topCategory: z
    .object({ id: z.number().int(), name: z.string(), color: categoryColorSchema, icon: categoryIconSchema })
    .nullable(),
  topAccount: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  currency: supportedCurrencySchema,
});

export type PayeeSummaryResponse = z.infer<typeof payeeSummaryResponseSchema>;

export const GET = route({
  params: IdParamSchema,
  response: payeeSummaryResponseSchema,
})(async ({ user, params }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const summary = await getPayeeSummary(user.id, budget.id, params.id);
  return { ...summary, currency: budget.defaultCurrency };
});

export const PATCH = route({
  params: IdParamSchema,
  body: PayeeUpdateSchema,
  response: payeeWithSuggestionSchema,
})(async ({ user, params, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const payee = await updatePayee(user.id, budget.id, params.id, {
    name: body.name,
    aliases: body.aliases,
    description: trimOrNull(body.description),
  });

  return {
    id: payee.id,
    name: payee.name,
    aliases: payee.aliases,
    description: payee.description,
    useCount: 0,
  };
});
