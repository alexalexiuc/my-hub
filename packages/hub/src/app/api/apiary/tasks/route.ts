import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryTasks, createApiaryTask } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { TaskCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const hiveId = searchParams.get('hiveId') ? Number(searchParams.get('hiveId')) : undefined;
  const yardId = searchParams.get('yardId') ? Number(searchParams.get('yardId')) : undefined;
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

  const { data } = parsed;
  const dueAt = data.dueAt ? new Date(data.dueAt) : undefined;

  const task = await createApiaryTask(user.id, {
    title: data.title,
    ...omitNullish({
      hiveId: data.hiveId,
      yardId: data.yardId,
      dueAt,
    }),
  });
  return NextResponse.json({ task }, { status: 201 });
});
