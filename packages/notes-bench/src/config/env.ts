import { getEnvVar } from '@my-hub/shared/utils';

/** Environment for the notes benchmarks. All keys are optional; commands fail with a hint when one they need is missing. */
export const benchEnv = {
  /** Postgres for the in-process harness (each run gets its own schema). Falls back to NOTES_DATABASE_URL. */
  get DATABASE_URL() {
    return getEnvVar('NOTES_BENCH_DATABASE_URL', '') || getEnvVar('NOTES_DATABASE_URL', '');
  },
  get EMBEDDINGS_PROVIDER() {
    return getEnvVar('EMBEDDINGS_PROVIDER', 'e5');
  },
  /** Ready-made access token for `--target` runs. */
  get TOKEN() {
    return getEnvVar('NOTES_BENCH_TOKEN', '');
  },
  get CLIENT_ID() {
    return getEnvVar('NOTES_BENCH_CLIENT_ID', '');
  },
  get CLIENT_SECRET() {
    return getEnvVar('NOTES_BENCH_CLIENT_SECRET', '');
  },
};
