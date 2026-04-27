import { route } from '@/lib/api/route';
import { getMcpServers } from '@my-hub/shared/services';

export const GET = route(async ({ user }) => {
  const servers = await getMcpServers(user.id);
  return servers;
});
