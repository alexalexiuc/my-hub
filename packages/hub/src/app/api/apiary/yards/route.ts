import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiaryYards, createApiaryYard } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const yards = await getApiaryYards(user.id);
  return NextResponse.json({ yards });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, location, notes } = body as { name?: string; location?: string; notes?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const yard = await createApiaryYard(user.id, { name: name.trim(), location: location ?? null, notes: notes ?? null });
  return NextResponse.json({ yard }, { status: 201 });
});
