import {
  createDb,
  createEmbeddingProvider,
  createNotesRuntime,
  notesEnv,
  type NotesRuntime,
  type NotesService,
} from '@my-hub/notes';
import { logger, UserInputError } from '@my-hub/shared/utils';

let runtime: Promise<NotesRuntime> | null = null;

/** True when the notes backend is configured (a database URL is set). */
export function notesConfigured(): boolean {
  return notesEnv.notesConfigured;
}

/**
 * The process-wide notes runtime: Postgres pool, embedding model (loaded once) and the per-user stores.
 * Created on first use; a failed start is not cached, so a later call retries.
 */
export function getNotesRuntime(): Promise<NotesRuntime> {
  if (!notesConfigured()) {
    return Promise.reject(new UserInputError('The notes server is not configured (NOTES_DATABASE_URL is not set).'));
  }
  runtime ??= (async () => {
    const t0 = Date.now();
    const db = await createDb({ connectionString: notesEnv.NOTES_DATABASE_URL });
    const embedder = createEmbeddingProvider();
    const rt = await createNotesRuntime({
      db,
      embedder,
      root: notesEnv.NOTES_ROOT,
      gitRemote: notesEnv.NOTES_GIT_REMOTE,
    });
    await rt.start();
    logger.info(`[notes] ready in ${Date.now() - t0} ms (embeddings: ${embedder.name}/${embedder.model})`);
    return rt;
  })().catch((err: unknown) => {
    runtime = null;
    throw err;
  });
  return runtime;
}

/** Starts loading the notes runtime in the background at boot. Failures are logged, not fatal. */
export function warmNotesRuntime(): void {
  if (!notesConfigured()) return;
  getNotesRuntime().catch((err: unknown) => {
    logger.error(`[notes] startup failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/** The notes service of one user. */
export async function notesFor(userId: string): Promise<NotesService> {
  return (await getNotesRuntime()).forUser(userId);
}
