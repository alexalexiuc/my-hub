import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getApiarySummary } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const summary = await getApiarySummary(user.id);
  return NextResponse.json(summary);
});
