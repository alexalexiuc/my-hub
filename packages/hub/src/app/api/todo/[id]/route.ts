import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { markTodoDone, deleteTodo } from '@my-hub/shared/services';

export const PATCH = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const todo = await markTodoDone(user.id, numId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ todo });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const todo = await deleteTodo(user.id, numId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ todo });
});
