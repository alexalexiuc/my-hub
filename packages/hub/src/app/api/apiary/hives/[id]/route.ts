import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiaryHive, updateApiaryHive, deleteApiaryHive } from '@my-hub/shared/services';

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const hive = await getApiaryHive(user.id, numId);
  if (!hive) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ hive });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const hive = await updateApiaryHive(user.id, numId, body);
  if (!hive) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ hive });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const hive = await deleteApiaryHive(user.id, numId);
  if (!hive) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ hive });
}
