import { getEnvVar } from '../utils';

/**
 * Shared infrastructure environment configuration.
 *
 * Uses lazy property getters so that importing this module at Next.js build
 * time (when env vars are not yet set) does not throw. Values are read on
 * first access, which always happens at request/runtime.
 */
export const sharedEnvConfig = {
  get DATABASE_URL() {
    return getEnvVar('DATABASE_URL');
  },
  get ENCRYPTION_KEY() {
    return getEnvVar('ENCRYPTION_KEY');
  },
  get AWS_REGION() {
    return getEnvVar('AWS_REGION');
  },
  get UNSUBSCRIBE_SECRET() {
    return getEnvVar('UNSUBSCRIBE_SECRET');
  },
  get SES_FROM_EMAIL() {
    return getEnvVar('SES_FROM_EMAIL');
  },
};
