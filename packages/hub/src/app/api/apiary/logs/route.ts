import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiaryLogs, createApiaryLog } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hiveId = searchParams.get('hive_id') ? Number(searchParams.get('hive_id')) : undefined;
  const type = searchParams.get('type') ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

  const logs = await getApiaryLogs(user.id, omitNullish({ hiveId, type, limit, offset }));
  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type } = body as { type?: string };
  if (!type?.trim()) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  const loggedAt = typeof body.logged_at === 'string' ? new Date(body.logged_at) : new Date();

  const log = await createApiaryLog(user.id, {
    type: type.trim(),
    loggedAt,
    ...omitNullish({
      hiveId: body.hive_id as number | undefined,
      notes: body.notes as string | undefined,
      data: body.data as Record<string, unknown> | undefined,
    }),
  });
  return NextResponse.json({ log }, { status: 201 });
}
