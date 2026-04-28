import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, addBudgetMember, findUserByEmail } from '@my-hub/shared/services';
import { okResponseSchema } from '../../contracts';

const InviteMemberSchema = z.object({
  email: z.string().email('Valid email required'),
});

export const POST = route({ body: InviteMemberSchema, response: okResponseSchema })(async ({ user, body }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const target = await findUserByEmail(body.email);
  if (!target) routeHttpError(404, { error: 'User not found' });

  await addBudgetMember(user.id, budget.id, target.id);

  return { ok: true };
});
