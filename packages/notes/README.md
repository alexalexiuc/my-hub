# @my-hub/notes

Core of the **Notes MCP** (`/api/notes/mcp`): a personal "remember this" index. Markdown files in git are the source of
truth; Postgres (pgvector + pg_trgm + unaccent) is a disposable search index. Design and decisions:
[`docs/notes-mcp-spec.md`](../../docs/notes-mcp-spec.md). The MCP tools live in `packages/mcp-server/src/notes`.

```
src/markdown.ts   parse / serialize (byte-exact round trip), entry add / edit / remove
src/store.ts      per-user git repo of .md files, write queue, one commit per write
src/db.ts         pool + schema (rebuilt automatically when model, dimension or schema version changes)
src/indexer.ts    file -> index rows, re-embeds only changed lines
src/search.ts     hybrid search: fts + trigram + vector legs, RRF fusion
src/resolve.ts    findExactNote: the note whose title or an alias equals the subject (remember does no fuzzy matching)
src/headers.ts    NoteHeader + header queries (browse, review queue)
src/service.ts    NotesRuntime / NotesService: search, read, remember, edit, delete, alias, recent, browse, reviewQueue,
                  merge, markReviewed, reindex
src/embeddings/   e5 (Transformers.js), ollama, fake providers
src/cli.ts        notes-cli: download-model | reindex | push | purge
```

## API (`NotesService`, one per user)

| Method                                                                          | What it does                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `remember(input)`                                                               | Appends to the note whose title or an alias equals `subject` (case/accents ignored), else creates a note with `reviewed: false`. `path` forces the target.                         |
| `search({ queries, category, limit })`                                          | Hybrid search (fts + trigram + vector, RRF). Up to 200 notes here; the `notes_search` tool caps at 20.                                                                             |
| `browse({ queries?, category?, tag?, updatedSince?, unreviewedOnly?, limit? })` | `NoteHeader`s (title, aliases, tags, entry count, first line, `reviewed`). With `queries`: ranked, with `score`/`matchedBy`; else ordered by category, title. Default 50, max 200. |
| `reviewQueue({ limit, suggestions })`                                           | Unreviewed notes, oldest first, each with `similar` existing notes (search by title + aliases), plus `remaining`.                                                                  |
| `merge(from, into)`                                                             | Moves entries, aliases (incl. `from`'s title), tags and free text into `into`, deletes `from`; one commit.                                                                         |
| `markReviewed(paths)`                                                           | Sets `reviewed: true` on 1-50 notes; one commit.                                                                                                                                   |
| `editEntry`, `deleteEntry`, `addAlias`, `recent`, `read`, `reindex`             | As named.                                                                                                                                                                          |

`reviewed` is a frontmatter key: `false` only when the value is `false`; absent means reviewed, so existing notes
never show up in the review queue.

## Run locally

You need Postgres with the `vector`, `pg_trgm` and `unaccent` extensions (the compose `notes-db` service is
`pgvector/pgvector:pg18`).

```bash
# 1. Database + MCP server through compose (builds the mcp image; first model start downloads ~120 MB)
docker compose -f infra/docker-compose.local.yml up --build notes-db mcp     # needs the root .env (see .env.example)

# 2. Or run the server on the host against any pgvector Postgres
export NOTES_DATABASE_URL=postgres://notes:notes@localhost:5433/notes
export NOTES_ROOT=./data/notes EMBEDDINGS_PROVIDER=fake     # fake = no model download, no semantic search
pnpm --filter @my-hub/mcp-server dev
```

Without `NOTES_DATABASE_URL` the server still boots; the notes tools answer with a "not configured" error.

## Environment

| Variable                      | Default               | Meaning                                                                                   |
| ----------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `NOTES_DATABASE_URL`          | -                     | Postgres with pgvector. Required for the notes tools.                                     |
| `NOTES_ROOT`                  | `./data/notes`        | One git repo per user: `<NOTES_ROOT>/<userId>/`.                                          |
| `EMBEDDINGS_PROVIDER`         | `e5`                  | `e5`, `ollama` or `fake`. Recorded in every benchmark result.                             |
| `EMBEDDINGS_MODEL`            | per provider          | e5: `Xenova/multilingual-e5-small`; ollama: `bge-m3`.                                     |
| `EMBEDDINGS_DIMENSIONS`       | e5 384 / fake 384     | Required for ollama (bge-m3 = 1024, embeddinggemma = 768).                                |
| `EMBEDDINGS_CACHE_DIR`        | `./data/model-cache`  | Where weights are cached (a volume in compose). Never downloaded per start.               |
| `EMBEDDINGS_LOCAL_MODEL_PATH` | -                     | Directory with pre-seeded weights (`<dir>/Xenova/multilingual-e5-small/...`); no network. |
| `OLLAMA_URL`                  | `http://ollama:11434` | Ollama server for `EMBEDDINGS_PROVIDER=ollama`.                                           |
| `NOTES_WARM_ON_BOOT`          | `true`                | Load the model and index changed files at boot, not on first use.                         |
| `NOTES_GIT_REMOTE`            | -                     | Private backup repo; `notes-cli push` pushes `main` there.                                |
| `NOTES_RRF_K`                 | `60`                  | Reciprocal Rank Fusion constant.                                                          |

## Switching embedding providers

Change `EMBEDDINGS_PROVIDER` (and model/dimensions) and restart. The index records the model and dimension; when they
differ it drops its tables and re-embeds every file at startup. Files are never touched. Ollama example:
`EMBEDDINGS_PROVIDER=ollama EMBEDDINGS_MODEL=bge-m3 EMBEDDINGS_DIMENSIONS=1024 OLLAMA_URL=http://ollama:11434`
(the `ollama` service itself is not in compose yet; add it only to benchmark).

## Model weights

The e5 weights download on first use into `EMBEDDINGS_CACHE_DIR`. Pre-seed so the first request never waits:

```bash
docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js download-model
```

On a host that cannot reach huggingface.co, copy the model folder (`config.json`, `tokenizer*.json`,
`onnx/model_quantized.onnx`) to `<dir>/Xenova/multilingual-e5-small/` and set `EMBEDDINGS_LOCAL_MODEL_PATH=<dir>`.

## Reindex, backup, purge

```bash
docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js reindex <userId>   # rebuild index from files
docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js push <userId>      # push to NOTES_GIT_REMOTE
docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js purge <userId>     # delete notes + index rows
```

`<userId>` is the folder name under `NOTES_ROOT`. Files edited by hand (Obsidian, `git pull`) are indexed at startup
or by `reindex`.

## Tests

```bash
pnpm --filter @my-hub/notes test:unit                                   # parser, slug, RRF (no DB)
NOTES_TEST_DATABASE_URL=postgres://user:pass@localhost/notes_test \
  pnpm --filter @my-hub/notes test:unit                                 # + integration tests (FakeProvider, real Postgres)
pnpm --filter @my-hub/mcp-server test:e2e                               # notes.e2e.ts needs a server with a notes backend
```

CI runs the integration tests against a `pgvector/pgvector:pg18` service container.

## Benchmarks

See [`packages/notes-bench`](../notes-bench/README.md).
