import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { setMcpServerEnabled, type McpServerName } from '@my-hub/shared/services';

const VALID_NAMES = new Set<string>(['calories', 'hive', 'products']);

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  if (!VALID_NAMES.has(name)) {
    return NextResponse.json({ error: 'Unknown server name' }, { status: 400 });
  }

  const body = await req.json() as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
  }

  const row = await setMcpServerEnabled(user.id, name as McpServerName, body.enabled);
  return NextResponse.json(row);
}
