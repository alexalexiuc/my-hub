import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripDay } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const dayId = Number(id);
  if (!Number.isInteger(dayId) || dayId <= 0) {
    return NextResponse.json({ error: 'Invalid day id' }, { status: 400 });
  }

  const removed = await deleteTripDay(user.id, dayId);
  if (!removed) return NextResponse.json({ error: 'Day note not found' }, { status: 404 });

  return NextResponse.json({ id: removed.id });
});
