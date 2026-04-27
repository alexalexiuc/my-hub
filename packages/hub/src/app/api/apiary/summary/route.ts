import { route } from '@/lib/api/route';
import { getApiarySummary } from '@my-hub/shared/services';

export const GET = route(async ({ user }) => {
  const summary = await getApiarySummary(user.id);
  return summary;
});
