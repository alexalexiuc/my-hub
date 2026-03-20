import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiaryHives, createApiaryHive } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yardId = searchParams.get('yard_id') ? Number(searchParams.get('yard_id')) : undefined;
  const active = searchParams.get('active') !== null ? searchParams.get('active') === 'true' : undefined;

  const hives = await getApiaryHives(user.id, omitNullish({ yardId, active }));
  return NextResponse.json({ hives });
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

  const { name } = body as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const hive = await createApiaryHive(user.id, {
    name: name.trim(),
    ...omitNullish({
      yardId: body.yard_id as number | undefined,
      queenStatus: body.queen_status as string | undefined,
      queenMarked: body.queen_marked as boolean | undefined,
      queenYear: body.queen_year as number | undefined,
      boxes: body.boxes as number | undefined,
      notes: body.notes as string | undefined,
    }),
  });
  return NextResponse.json({ hive }, { status: 201 });
}
