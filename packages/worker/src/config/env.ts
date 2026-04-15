import { getEnvVar } from '@my-hub/shared/utils';

/**
 * Worker-specific environment configuration.
 *
 * Uses lazy property getters so the module can be imported without throwing
 * when env vars are not yet set (e.g. in tests or tooling). Values are read
 * on first access, which always happens at runtime for a running worker.
 *
 * Vars consumed exclusively by @my-hub/shared services (DATABASE_URL,
 * AWS_REGION) are repeated here only where the worker reads them directly
 * (e.g. db-backup passes DATABASE_URL to pg_dump).
 */
export const workerEnvConfig = {
  /** Base URL of the Hub, used for building report links and unsubscribe URLs. */
  get HUB_URL() {
    return getEnvVar('HUB_URL');
  },
  /** RapidAPI key for AeroDataBox flight data. Empty string disables flight sync. */
  get RAPIDAPI_KEY() {
    return getEnvVar('RAPIDAPI_KEY', '');
  },
  /** S3 bucket name for database backups. Empty string disables DB backup. */
  get S3_BACKUP_BUCKET() {
    return getEnvVar('S3_BACKUP_BUCKET', '');
  },
  get SES_FROM_EMAIL() {
    return getEnvVar('SES_FROM_EMAIL');
  },
  get UNSUBSCRIBE_SECRET() {
    return getEnvVar('UNSUBSCRIBE_SECRET');
  },
  /**
   * Read directly by db-backup to pass to pg_dump. Empty-string default so
   * the optional-backup guard (`if (!databaseUrl)`) works without throwing.
   */
  get DATABASE_URL() {
    return getEnvVar('DATABASE_URL', '');
  },
  /** Read directly by db-backup's optional-backup guard. */
  get AWS_REGION() {
    return getEnvVar('AWS_REGION', '');
  },
};
