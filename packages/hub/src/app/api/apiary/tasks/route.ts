import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryTasks, createApiaryTask } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { TaskCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const hiveId = searchParams.get('hive_id') ? Number(searchParams.get('hive_id')) : undefined;
  const yardId = searchParams.get('yard_id') ? Number(searchParams.get('yard_id')) : undefined;
  const completed = searchParams.get('completed') !== null ? searchParams.get('completed') === 'true' : undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

  const tasks = await getApiaryTasks(user.id, omitNullish({ hiveId, yardId, completed, limit }));
  return NextResponse.json({ tasks });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TaskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const dueAt = data.due_at ? new Date(data.due_at) : undefined;

  const task = await createApiaryTask(user.id, {
    title: data.title,
    ...omitNullish({
      hiveId: data.hive_id,
      yardId: data.yard_id,
      dueAt,
    }),
  });
  return NextResponse.json({ task }, { status: 201 });
});
