import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getLabels } from '@my-hub/shared/services';

const labelsResponseSchema = z.object({
  labels: z.array(z.string()),
});

export type LabelsResponse = z.infer<typeof labelsResponseSchema>;

export const GET = route({ response: labelsResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const labels = await getLabels(user.id, budget.id);
  return { labels };
});
