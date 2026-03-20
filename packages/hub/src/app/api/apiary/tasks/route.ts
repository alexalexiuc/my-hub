import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiaryTasks, createApiaryTask } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hiveId = searchParams.get('hive_id') ? Number(searchParams.get('hive_id')) : undefined;
  const completed = searchParams.get('completed') !== null ? searchParams.get('completed') === 'true' : undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

  const tasks = await getApiaryTasks(user.id, omitNullish({ hiveId, completed, limit }));
  return NextResponse.json({ tasks });
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

  const { title } = body as { title?: string };
  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const dueAt = typeof body.due_at === 'string' ? new Date(body.due_at) : undefined;

  const task = await createApiaryTask(user.id, {
    title: title.trim(),
    ...omitNullish({
      hiveId: body.hive_id as number | undefined,
      dueAt,
    }),
  });
  return NextResponse.json({ task }, { status: 201 });
}
