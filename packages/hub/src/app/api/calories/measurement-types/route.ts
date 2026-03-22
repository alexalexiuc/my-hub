import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getMeasurementTypes } from '@my-hub/shared/services';

export const GET = withAuth(async () => {
  const types = await getMeasurementTypes();
  return NextResponse.json({ types });
});
