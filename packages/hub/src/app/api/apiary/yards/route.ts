import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiaryYards, createApiaryYard } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const yards = await getApiaryYards(user.id);
  return NextResponse.json({ yards });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
