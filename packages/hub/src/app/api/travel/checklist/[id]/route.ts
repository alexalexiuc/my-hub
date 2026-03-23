import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteChecklistItem, updateChecklistItem } from '@my-hub/shared/services';

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const item = await updateChecklistItem(user.id, itemId, {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    done: typeof body.done === 'boolean' ? body.done : undefined,
  });

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  return NextResponse.json({ item });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  const item = await deleteChecklistItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  return NextResponse.json({ item });
});
