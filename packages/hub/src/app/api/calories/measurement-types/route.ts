import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getMeasurementTypes } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const types = await getMeasurementTypes();
  return NextResponse.json({ types });
}
