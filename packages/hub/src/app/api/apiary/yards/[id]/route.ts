import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryYard, updateApiaryYard, deleteApiaryYard } from '@my-hub/shared/services';

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const yard = await getApiaryYard(user.id, numId);
  if (!yard) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ yard });
});

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const yard = await updateApiaryYard(user.id, numId, body);
  if (!yard) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ yard });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = parseId(id);
  if (!numId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const yard = await deleteApiaryYard(user.id, numId);
  if (!yard) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ yard });
});
