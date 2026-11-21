# Feature: Notes

| Field    | Value                   |
| -------- | ----------------------- |
| Status   | in-progress             |
| Priority | medium                  |
| File     | `mcps/feature-notes.md` |

---

## Summary

A personal "remember this" index of small practical facts about things and services (which carpet-cleaning company,
which engine oil, which detergent was better), written and searched by Claude from claude.ai on the phone. Plain
Markdown files in git are the source of truth; a disposable Postgres index (pgvector + pg_trgm + unaccent) makes
vague, misspelled and cross-language (RO / RU / EN) queries find the right note. The full design, decisions and
spike plan live in [`docs/notes-mcp-spec.md`](../../notes-mcp-spec.md).

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | `notes_search` takes 1-5 query phrasings and returns the best notes with their best matching entry lines and server timings.                                                 |
| FR-02 | `notes_remember` appends one dated entry to the note its `subject` resolves to, or creates a note. Ambiguous subjects return candidates and write nothing; `path` overrides. |
| FR-03 | `notes_edit_entry` / `notes_delete_entry` change exactly one entry line by its `^id`; `notes_add_alias` adds a name to a note's frontmatter.                                 |
| FR-04 | `notes_read`, `notes_list` and `notes_recent` browse notes. All tools are per user: one user never sees another's notes.                                                     |
| FR-05 | Every write is one git commit in the user's notes repo (`notes(<path>): +entry ^id`). Files edited by hand are picked up at startup or by `reindex`.                         |
| FR-06 | The server never saves silently: tool descriptions tell Claude to offer in one line unless the user asked to save.                                                           |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Code lives in `packages/notes` (core) and `packages/mcp-server/src/notes` (tools). The index is its own Postgres (`notes-db`, `pgvector/pgvector:pg18`), not the Drizzle DB.  |
| TR-02 | Files: `<NOTES_ROOT>/<userId>/<category>/<slug>.md`. The parser round-trips untouched files byte for byte; edits change single lines only.                                    |
| TR-03 | Search = FTS (simple config, unaccent) + trigram on entries and on note names + vector on entries and on note names, fused with Reciprocal Rank Fusion (k = 60).              |
| TR-04 | Embeddings: `multilingual-e5-small` int8 via Transformers.js in-process (`EMBEDDINGS_PROVIDER=e5`), Ollama or a fake provider; selected by env, dimension recorded in the DB. |
| TR-05 | A changed embedding model / dimension / schema version drops and rebuilds the index from the files automatically.                                                             |
| TR-06 | Writes are serialised per user (file, commit and index update happen in one queue).                                                                                           |
| TR-07 | The mcp image is Debian-based (glibc) because onnxruntime-node ships glibc-only binaries; it installs `git`.                                                                  |
| TR-08 | Benchmarks (`packages/notes-bench`) run in an isolated schema and temp directory, or read-only through the MCP endpoint; they never write to the real notes repo.             |

---

## Open Questions

- [ ] Real e5 relevance and latency numbers (the sandbox could not download the model): run `packages/notes-bench` on the VPS.
- [ ] HNSW index: needed above ~20k entries? (vector leg is a sequential scan today.)
- [ ] `remember` match threshold / vector floor; RRF `k` and per-leg weights.
- [ ] Vector legs always return nearest neighbours: add a minimum-similarity cut-off once real score distributions are known.
- [ ] Hub "Delete all my data" does not yet remove notes (`notes-cli purge <userId>` does).
- [ ] Notes backup push scheduling (`notes-cli push` exists; no scheduler yet).

---

## Acceptance Criteria

- `pnpm --filter @my-hub/mcp-server list-tools notes` lists 8 tools.
- `packages/notes` unit + integration tests pass (integration needs `NOTES_TEST_DATABASE_URL`).
- `packages/mcp-server/e2e/notes.e2e.ts` passes against a server with a notes backend.
- `pnpm --filter @my-hub/notes-bench bench:relevance` prints recall@1 / recall@5 / MRR for fts, trigram, vector, hybrid and hybrid-multi.
