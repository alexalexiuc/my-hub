import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { updateApiaryTask, deleteApiaryTask } from '@my-hub/shared/services';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const task = await updateApiaryTask(user.id, numId, body);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const task = await deleteApiaryTask(user.id, numId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ task });
}
