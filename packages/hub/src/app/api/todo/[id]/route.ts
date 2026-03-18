import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { markTodoDone, deleteTodo } from '@my-hub/shared/services';

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const todo = await markTodoDone(user.id, numId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ todo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const todo = await deleteTodo(user.id, numId);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ todo });
}
