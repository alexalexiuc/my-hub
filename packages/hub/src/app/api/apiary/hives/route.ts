import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryHives, createApiaryHive } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { HiveCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const yardId = searchParams.get('yardId') ? Number(searchParams.get('yardId')) : undefined;
  const active = searchParams.get('active') !== null ? searchParams.get('active') === 'true' : undefined;

  const hives = await getApiaryHives(user.id, omitNullish({ yardId, active }));
  return NextResponse.json({ hives });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = HiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;

  const hive = await createApiaryHive(user.id, {
    name: data.name,
    ...omitNullish({
      yardId: data.yardId,
      queenStatus: data.queenStatus,
      queenMarked: data.queenMarked,
      queenYear: data.queenYear,
      boxes: data.boxes,
      notes: data.notes,
    }),
  });
  return NextResponse.json({ hive }, { status: 201 });
});
