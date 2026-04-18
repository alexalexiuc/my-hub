import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { travelFilesConfig } from '@/lib/travel-files-config';

export const GET = withAuth(async () => {
  return NextResponse.json({
    maxMb: travelFilesConfig.maxMb,
    allowedMime: travelFilesConfig.allowedMime,
  });
});
