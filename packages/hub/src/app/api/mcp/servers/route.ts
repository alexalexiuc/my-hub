import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getMcpServers } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const servers = await getMcpServers(user.id);
  return NextResponse.json(servers);
}
