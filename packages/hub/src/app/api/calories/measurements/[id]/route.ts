import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteMeasurement } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const deleted = await deleteMeasurement(numId, user.id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deleted: true });
});
