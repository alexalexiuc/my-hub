import { route } from '@/lib/api/route';
import { travelFilesConfig } from '@/lib/travel-files-config';

export const GET = route(async () => {
  return {
    maxMb: travelFilesConfig.maxMb,
    allowedMime: travelFilesConfig.allowedMime,
  };
});
