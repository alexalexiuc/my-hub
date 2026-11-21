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
src/resolve.ts    "which existing note is this subject?" for remember
src/service.ts    NotesRuntime / NotesService: search, read, remember, edit, delete, alias, recent, list, reindex
src/embeddings/   e5 (Transformers.js), ollama, fake providers
src/cli.ts        notes-cli: download-model | reindex | push | purge
```

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

| Variable                                             | Default               | Meaning                                                                                   |
| ---------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `NOTES_DATABASE_URL`                                 | -                     | Postgres with pgvector. Required for the notes tools.                                     |
| `NOTES_ROOT`                                         | `./data/notes`        | One git repo per user: `<NOTES_ROOT>/<userId>/`.                                          |
| `EMBEDDINGS_PROVIDER`                                | `e5`                  | `e5`, `ollama` or `fake`. Recorded in every benchmark result.                             |
| `EMBEDDINGS_MODEL`                                   | per provider          | e5: `Xenova/multilingual-e5-small`; ollama: `bge-m3`.                                     |
| `EMBEDDINGS_DIMENSIONS`                              | e5 384 / fake 384     | Required for ollama (bge-m3 = 1024, embeddinggemma = 768).                                |
| `EMBEDDINGS_CACHE_DIR`                               | `./data/model-cache`  | Where weights are cached (a volume in compose). Never downloaded per start.               |
| `EMBEDDINGS_LOCAL_MODEL_PATH`                        | -                     | Directory with pre-seeded weights (`<dir>/Xenova/multilingual-e5-small/...`); no network. |
| `OLLAMA_URL`                                         | `http://ollama:11434` | Ollama server for `EMBEDDINGS_PROVIDER=ollama`.                                           |
| `NOTES_WARM_ON_BOOT`                                 | `true`                | Load the model and index changed files at boot, not on first use.                         |
| `NOTES_GIT_REMOTE`                                   | -                     | Private backup repo; `notes-cli push` pushes `main` there.                                |
| `NOTES_MATCH_THRESHOLD` / `NOTES_MATCH_VECTOR_FLOOR` | `0.6` / `0.8`         | `remember` subject matching (tune with real data).                                        |
| `NOTES_RRF_K`                                        | `60`                  | Reciprocal Rank Fusion constant.                                                          |

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
pnpm --filter @my-hub/notes test:unit                                   # parser, slug, RRF, resolution (no DB)
NOTES_TEST_DATABASE_URL=postgres://user:pass@localhost/notes_test \
  pnpm --filter @my-hub/notes test:unit                                 # + integration tests (FakeProvider, real Postgres)
pnpm --filter @my-hub/mcp-server test:e2e                               # notes.e2e.ts needs a server with a notes backend
```

CI runs the integration tests against a `pgvector/pgvector:pg18` service container.

## Benchmarks

See [`packages/notes-bench`](../notes-bench/README.md).
