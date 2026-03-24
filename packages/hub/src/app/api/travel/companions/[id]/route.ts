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

  if (typeof body.name === 'string' && body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
  }

  const companion = await updateTripCompanion(user.id, companionId, {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    email: body.email === null ? null : typeof body.email === 'string' ? body.email.trim() || null : undefined,
    phone: body.phone === null ? null : typeof body.phone === 'string' ? body.phone.trim() || null : undefined,
    notes: body.notes === null ? null : typeof body.notes === 'string' ? body.notes : undefined,
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
