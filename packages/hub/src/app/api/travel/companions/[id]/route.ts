import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripCompanion, updateTripCompanion } from '@my-hub/shared/services';

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const companionId = Number(id);

  if (!Number.isInteger(companionId) || companionId <= 0) {
    return NextResponse.json({ error: 'Invalid companion id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const companion = await updateTripCompanion(user.id, companionId, {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });

  if (!companion) return NextResponse.json({ error: 'Companion not found' }, { status: 404 });

  return NextResponse.json({ companion });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const companionId = Number(id);

  if (!Number.isInteger(companionId) || companionId <= 0) {
    return NextResponse.json({ error: 'Invalid companion id' }, { status: 400 });
  }

  const companion = await deleteTripCompanion(user.id, companionId);
  if (!companion) return NextResponse.json({ error: 'Companion not found' }, { status: 404 });

  return NextResponse.json({ companion });
});
