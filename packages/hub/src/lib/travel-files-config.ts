import {
  TRAVEL_FILES_ALLOWED_MIME_DEFAULT,
  TRAVEL_FILES_MAX_MB_DEFAULT,
  TRAVEL_FILES_ROOT_DEFAULT,
} from '@my-hub/shared/constants';

const DEFAULT_ALLOWED_MIME = [...TRAVEL_FILES_ALLOWED_MIME_DEFAULT];
const DEFAULT_MAX_MB = TRAVEL_FILES_MAX_MB_DEFAULT;

function parseMaxMb(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_MB;
}

function parseAllowedMime(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_ALLOWED_MIME;

  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : DEFAULT_ALLOWED_MIME;
}

export const travelFilesConfig = {
  storageRoot: process.env['TRAVEL_FILES_ROOT'] ?? TRAVEL_FILES_ROOT_DEFAULT,
  maxMb: parseMaxMb(process.env['TRAVEL_FILES_MAX_MB']),
  allowedMime: parseAllowedMime(process.env['TRAVEL_FILES_ALLOWED_MIME']),
} as const;

export function getTravelFileMaxBytes(): number {
  return travelFilesConfig.maxMb * 1024 * 1024;
}
