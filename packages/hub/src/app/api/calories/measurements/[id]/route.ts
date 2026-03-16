import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { deleteMeasurement } from '@my-hub/shared/services';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const deleted = await deleteMeasurement(numId, user.id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
