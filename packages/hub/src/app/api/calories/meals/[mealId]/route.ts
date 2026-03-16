import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { deleteMeal } from '@my-hub/shared/services';

export async function DELETE(_req: Request, { params }: { params: Promise<{ mealId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mealId } = await params;
  const deleted = await deleteMeal(user.id, mealId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
