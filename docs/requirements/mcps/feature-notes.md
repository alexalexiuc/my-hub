# Feature: Notes

| Field    | Value                   |
| -------- | ----------------------- |
| Status   | in-progress             |
| Priority | medium                  |
| File     | `mcps/feature-notes.md` |

---

## Summary

A personal "remember this" index of small practical facts about things and services (which vendor or product was
used and how it turned out, a price paid, a how-to), written and searched by Claude from claude.ai on the phone. Plain
Markdown files (one directory per user) are the source of truth; a disposable Postgres index (pgvector + pg_trgm + unaccent) makes
vague, misspelled and cross-language (RO / RU / EN) queries find the right note. The full design, decisions and
spike plan live in [`docs/notes-mcp-spec.md`](../../notes-mcp-spec.md).

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | `notes_search` takes 1-5 query phrasings and returns the best notes with their best matching entry lines and server timings.                                                                                                               |
| FR-02 | `notes_remember` appends one dated entry to the note whose title or an alias equals `subject` exactly (case and accents ignored), else creates a note marked `reviewed: false`. No fuzzy matching; `path` writes to exactly that note.     |
| FR-03 | `notes_edit_entry` / `notes_delete_entry` change exactly one entry line by its `^id`; `notes_add_alias` adds a name to a note's frontmatter. Deleting the last entry of a note with no other text deletes the note.                        |
| FR-04 | `notes_read`, `notes_browse` (headers filtered by category / tag / date / unreviewed, optionally ranked, up to 200) and `notes_recent` browse notes. All tools are per user: one user never sees another's notes.                          |
| FR-05 | Files edited by hand are picked up at startup or by `reindex`.                                                                                                                                                                             |
| FR-06 | The server never saves silently: tool descriptions tell Claude to offer in one line unless the user asked to save.                                                                                                                         |
| FR-07 | Duplicates are cleaned up only when the user asks: `notes_review_duplicates` lists unreviewed notes with similar notes, `notes_merge` folds one note into another (entries, aliases, tags; one commit), `notes_mark_reviewed` clears them. |
| FR-08 | Hub "Delete all my data" deletes the user's notes directory (files) and index rows through the mcp-server's internal `POST /api/notes/delete-all` (JWT signed with `NEXTAUTH_SECRET`); it fails if the mcp-server cannot be reached.       |
| FR-09 | The worker's daily `notes-backup` job (02:00 UTC) uploads a tar.gz of all notes to `S3_BACKUP_BUCKET` under `notes/`. Restore: untar into the notes volume, then `notes-cli reindex <userId>`.                                             |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Code lives in `packages/notes` (core) and `packages/mcp-server/src/notes` (tools). The index is its own Postgres (`notes-db`, `pgvector/pgvector:pg18`), not the Drizzle DB.                                                                                                                             |
| TR-02 | Files: `<NOTES_ROOT>/<userId>/<category>/<slug>.md`. The parser round-trips untouched files byte for byte; edits change single lines only.                                                                                                                                                               |
| TR-03 | Search = FTS (simple config, unaccent) + trigram on entries and on note names + vector on entries and on note names, fused with Reciprocal Rank Fusion (k = 60).                                                                                                                                         |
| TR-04 | Embeddings: `multilingual-e5-small` int8 via Transformers.js in-process (`EMBEDDINGS_PROVIDER=e5`) or a fake provider for tests; selected by env, dimension recorded in the DB.                                                                                                                          |
| TR-05 | A changed embedding model / dimension / schema version drops and rebuilds the index from the files automatically.                                                                                                                                                                                        |
| TR-06 | Writes are serialised per user (file and index update happen in one queue). Each note is indexed in one transaction; an index failure after the write is logged, not returned as an error, and the next call re-syncs from the files.                                                                    |
| TR-07 | The mcp image is Debian-based (glibc) because onnxruntime-node ships glibc-only binaries.                                                                                                                                                                                                                |
| TR-08 | Benchmarks (`packages/notes-bench`) run in an isolated schema and temp directory, or read-only through the MCP endpoint. The one exception is `seed --target ... --yes`, which writes ~230 entries (more on every re-run) into the token account's notes: run it only against a dedicated bench account. |

---

## Open Questions

- [x] Real e5 relevance and latency numbers (dev box and VPS, spec section 15).
- [ ] HNSW index: needed above ~20k entries? (vector leg is a sequential scan today.)
- [ ] RRF `k` and per-leg weights.
- [ ] Vector legs always return nearest neighbours: add a minimum-similarity cut-off once real score distributions are known.

---

## Acceptance Criteria

- `pnpm --filter @my-hub/mcp-server list-tools notes` lists 11 tools.
- `packages/notes` unit + integration tests pass (integration needs `NOTES_TEST_DATABASE_URL`).
- `packages/mcp-server/e2e/notes.e2e.ts` passes against a server with a notes backend.
- `pnpm --filter @my-hub/notes-bench bench:relevance` prints recall@1 / recall@5 / MRR for fts, trigram, vector, hybrid and hybrid-multi.
