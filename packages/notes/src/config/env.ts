import { getEnvVar } from '@my-hub/shared/utils';

function num(key: string, fallback: number): number {
  const n = Number(getEnvVar(key, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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
  /** Directory holding one git repo of Markdown files per user: `<NOTES_ROOT>/<userId>/`. */
  get NOTES_ROOT() {
    return getEnvVar('NOTES_ROOT', './data/notes');
  },
  /** `e5` (in-process Transformers.js), `ollama`, or `fake` (deterministic, tests only). */
  get EMBEDDINGS_PROVIDER() {
    return getEnvVar('EMBEDDINGS_PROVIDER', 'e5');
  },
  get EMBEDDINGS_MODEL() {
    return getEnvVar('EMBEDDINGS_MODEL', '');
  },
  /** Embedding size; only read for `ollama`/`fake`. e5-small is fixed at 384. */
  get EMBEDDINGS_DIMENSIONS() {
    return num('EMBEDDINGS_DIMENSIONS', 0);
  },
  /** Where Transformers.js caches model weights (mount a volume; never download on every start). */
  get EMBEDDINGS_CACHE_DIR() {
    return getEnvVar('EMBEDDINGS_CACHE_DIR', './data/model-cache');
  },
  /** Directory with pre-seeded model weights (`<dir>/<model id>/...`). When set, no network access is needed. */
  get EMBEDDINGS_LOCAL_MODEL_PATH() {
    return getEnvVar('EMBEDDINGS_LOCAL_MODEL_PATH', '');
  },
  get OLLAMA_URL() {
    return getEnvVar('OLLAMA_URL', 'http://ollama:11434');
  },
  /** Load the embedding model at boot instead of on first use. */
  get NOTES_WARM_ON_BOOT() {
    return getEnvVar('NOTES_WARM_ON_BOOT', 'true') !== 'false';
  },
  /** Optional git remote of the private backup repo, e.g. `git@github.com:me/notes-backup.git`. */
  get NOTES_GIT_REMOTE() {
    return getEnvVar('NOTES_GIT_REMOTE', '');
  },
  get NOTES_RRF_K() {
    return num('NOTES_RRF_K', 60);
  },
};
