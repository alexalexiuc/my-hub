import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getApiarySummary } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const summary = await getApiarySummary(user.id);
  return NextResponse.json(summary);
}
