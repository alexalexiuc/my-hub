import { envConfig } from '../config/env';

export const travelFilesConfig = {
  storageRoot: envConfig.TRAVEL_FILES_ROOT,
  maxMb: envConfig.TRAVEL_FILES_MAX_MB,
  allowedMime: envConfig.TRAVEL_FILES_ALLOWED_MIME,
} as const;

export function getTravelFileMaxBytes(): number {
  return travelFilesConfig.maxMb * 1024 * 1024;
}
