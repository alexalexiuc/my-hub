import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryLogs, createApiaryLog } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { LogCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const hiveId = searchParams.get('hiveId') ? Number(searchParams.get('hiveId')) : undefined;
  const type = searchParams.get('type') ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
  const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

  const logs = await getApiaryLogs(user.id, omitNullish({ hiveId, type, limit, offset }));
  return NextResponse.json({ logs });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const loggedAt = data.loggedAt ? new Date(data.loggedAt) : new Date();

  const log = await createApiaryLog(user.id, {
    type: data.type,
    loggedAt,
    ...omitNullish({
      hiveId: data.hiveId,
      notes: data.notes,
      data: data.data,
    }),
  });
  return NextResponse.json({ log }, { status: 201 });
});
