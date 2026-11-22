import { getEnvVar } from '@my-hub/shared/utils';

/** Environment for the notes store. All keys are optional here; callers fail fast when a required one is missing. */
export const notesEnv = {
  /** Postgres (with pgvector, pg_trgm, unaccent) holding the disposable search index. */
  get NOTES_DATABASE_URL() {
    return getEnvVar('NOTES_DATABASE_URL');
  },
  /** True when NOTES_DATABASE_URL is set; servers that host notes optionally check this before using it. */
  get notesConfigured() {
    return getEnvVar('NOTES_DATABASE_URL', '') !== '';
  },
  /** Directory holding one directory of Markdown files per user: `<NOTES_ROOT>/<userId>/`. */
  get NOTES_ROOT() {
    return getEnvVar('NOTES_ROOT', './data/notes');
  },
  /** `e5` (in-process Transformers.js) or `fake` (deterministic, tests only). */
  get EMBEDDINGS_PROVIDER() {
    return getEnvVar('EMBEDDINGS_PROVIDER', 'e5');
  },
  /** Where Transformers.js caches model weights (mount a volume; never download on every start). */
  get EMBEDDINGS_CACHE_DIR() {
    return getEnvVar('EMBEDDINGS_CACHE_DIR', './data/model-cache');
  },
  /** Directory with pre-seeded model weights (`<dir>/<model id>/...`). When set, no network access is needed. */
  get EMBEDDINGS_LOCAL_MODEL_PATH() {
    return getEnvVar('EMBEDDINGS_LOCAL_MODEL_PATH', '');
  },
};
