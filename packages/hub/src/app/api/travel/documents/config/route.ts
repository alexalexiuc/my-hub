import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { travelFilesConfig } from '@/lib/travel-files-config';

export const GET = withAuth(async () => {
  return NextResponse.json({
    max_mb: travelFilesConfig.maxMb,
    allowed_mime: travelFilesConfig.allowedMime,
  });
});
