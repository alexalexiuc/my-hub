import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getMcpServers } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const servers = await getMcpServers(user.id);
  return NextResponse.json(servers);
});
