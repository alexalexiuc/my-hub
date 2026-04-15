import { getEnvVar } from '@my-hub/shared/utils';

/**
 * Worker-specific environment configuration.
 *
 * Eagerly initialized — the worker process always has all env vars set at
 * startup. Vars shared with other packages (DATABASE_URL, AWS_REGION) are
 * provided by @my-hub/shared services internally and are not repeated here.
 */
export const workerEnvConfig = {
  /** Base URL of the Hub, used for building report links and unsubscribe URLs. */
  HUB_URL: getEnvVar('HUB_URL'),
  /** RapidAPI key for AeroDataBox flight data. Empty string disables flight sync. */
  RAPIDAPI_KEY: getEnvVar('RAPIDAPI_KEY', ''),
  /** S3 bucket name for database backups. Empty string disables DB backup. */
  S3_BACKUP_BUCKET: getEnvVar('S3_BACKUP_BUCKET', ''),
  /** SES from email address for sending emails. */
  SES_FROM_EMAIL: getEnvVar('SES_FROM_EMAIL'),
  /** Unsubscribe secret for generating unsubscribe tokens. */
  UNSUBSCRIBE_SECRET: getEnvVar('UNSUBSCRIBE_SECRET'),
  /** Database URL for connecting to the database. */
  DATABASE_URL: getEnvVar('DATABASE_URL', ''),
  /** AWS region for S3 and other AWS services. */
  AWS_REGION: getEnvVar('AWS_REGION', ''),
} as const;
