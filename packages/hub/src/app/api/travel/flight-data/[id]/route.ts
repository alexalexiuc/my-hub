import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { setFlightDataAutoUpdate } from '@my-hub/shared/services';

export const PATCH = withAuth<{ id: string }>(async ({ req, params }) => {
  const { id } = await params;
  const flightDataId = Number(id);
  if (!Number.isInteger(flightDataId) || flightDataId <= 0) {
    return NextResponse.json({ error: 'Invalid flight data id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.auto_update_enabled !== 'boolean') {
    return NextResponse.json({ error: 'auto_update_enabled (boolean) is required' }, { status: 400 });
  }

  await setFlightDataAutoUpdate(flightDataId, body.auto_update_enabled);

  return NextResponse.json({ ok: true });
});
