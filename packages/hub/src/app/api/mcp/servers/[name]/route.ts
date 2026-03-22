import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { setMcpServerEnabled } from '@my-hub/shared/services';
import { McpServerName } from '@my-hub/shared/schema';

const VALID_NAMES = new Set<string>(Object.values(McpServerName));

export const PATCH = withAuth<{ name: string }>(async ({ req, user, params }) => {
  const { name } = await params;
  if (!VALID_NAMES.has(name)) {
    return NextResponse.json({ error: 'Unknown server name' }, { status: 400 });
  }

  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
  }

  const row = await setMcpServerEnabled(user.id, name as McpServerName, body.enabled);
  return NextResponse.json(row);
});
