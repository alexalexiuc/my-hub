import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteApiaryLog } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const log = await deleteApiaryLog(user.id, numId);
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ log });
});
