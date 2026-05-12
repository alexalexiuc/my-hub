import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, updatePayee } from '@my-hub/shared/services';
import { trimOrNull } from '@my-hub/shared/utils';
import { payeeSuggestionSchema } from '../route';

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

const PayeeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').optional(),
  aliases: z.array(z.string().trim()).optional(),
  description: z.string().trim().nullable().optional(),
});

export const PATCH = route({
  params: IdParamSchema,
  body: PayeeUpdateSchema,
  response: payeeSuggestionSchema,
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
    lastUsedAt: null,
    recentCategoryId: null,
    recentAccountId: null,
  };
});
