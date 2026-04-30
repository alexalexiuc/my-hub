import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { generateCaloriesAutomationKey } from '@my-hub/shared/services';

export const POST = withAuth(async ({ user }) => {
  const automationApiKey = await generateCaloriesAutomationKey(user.id);
  return NextResponse.json({ automationApiKey });
});
