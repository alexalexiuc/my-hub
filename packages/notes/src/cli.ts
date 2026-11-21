#!/usr/bin/env node
import { createDb } from './db';
import { createEmbeddingProvider } from './embeddings';
import { notesEnv } from './config/env';
import { createNotesRuntime } from './service';

const USAGE = `Usage: notes-cli <command> [userId]

  download-model      load the embedding model once so its weights are cached on the volume
  reindex <userId>    rebuild the search index from the user's Markdown files (re-embeds everything)
  push <userId>       push the user's notes repo to NOTES_GIT_REMOTE
  purge <userId>      DELETE the user's notes directory and index rows

User ids are the folder names under NOTES_ROOT. Reads NOTES_DATABASE_URL, NOTES_ROOT, EMBEDDINGS_* from the environment.`;

async function main() {
  const [command, userId] = process.argv.slice(2);
  if (command === 'download-model') {
    const embedder = createEmbeddingProvider();
    const t0 = Date.now();
    await embedder.ready();
    await embedder.embedQueries(['warmup']);
    process.stdout.write(`${embedder.name}/${embedder.model} ready in ${Date.now() - t0} ms\n`);
    return;
  }
  if (!command || !userId || !['reindex', 'push', 'purge'].includes(command)) throw new Error(USAGE);

  const db = await createDb({ connectionString: notesEnv.NOTES_DATABASE_URL });
  const runtime = await createNotesRuntime({
    db,
    embedder: createEmbeddingProvider(),
    root: notesEnv.NOTES_ROOT,
    gitRemote: notesEnv.NOTES_GIT_REMOTE,
  });
  try {
    const notes = runtime.forUser(userId);
    if (command === 'reindex') {
      await runtime.embedder.ready();
      process.stdout.write(`${JSON.stringify(await notes.reindex({ full: true }))}\n`);
    } else if (command === 'push') {
      process.stdout.write(`${JSON.stringify(await notes.push())}\n`);
    } else {
      await notes.deleteAll();
      process.stdout.write(`purged notes of ${userId}\n`);
    }
  } finally {
    await runtime.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
