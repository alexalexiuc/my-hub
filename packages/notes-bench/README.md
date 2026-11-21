# @my-hub/notes-bench

Re-runnable benchmarks for the Notes MCP: embedding latency, `remember` end to end, `search` per data tier and under
concurrency, relevance (recall@1, recall@5, MRR) per configuration, and RAM. Each run writes one JSON file to
`results/` (timestamp, git SHA, host, CPU/RAM limits, embedding provider and model, DB version, all metrics) and prints a
summary table. Spec: [`docs/notes-mcp-spec.md`](../../docs/notes-mcp-spec.md) section 11.

## Two modes

| Mode                  | How                                    | What it does                                                                                                                                                                      |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **direct** (default)  | in-process, `NOTES_BENCH_DATABASE_URL` | Builds its own notes stack in an **isolated Postgres schema and a temp directory** (dropped afterwards). Safe: never touches the real notes repo or index. Does everything below. |
| **remote** `--target` | MCP JSON-RPC over HTTP                 | `relevance` and `search` through the real endpoint, so numbers include transport, TLS and OAuth; server-side `timings` separate network from compute. Read-only on the target.    |

`embed` and `write` measure the process they run in, so run them in direct mode (on the server host or inside the
container). `seed --target` is the only command that writes to a remote: it loads the seed corpus into the notes of the
account behind the token, so use a dedicated bench account (notes are per user).

## Commands

```bash
export NOTES_BENCH_DATABASE_URL=postgres://notes:pw@localhost:5433/notes   # direct mode; any pgvector Postgres

pnpm --filter @my-hub/notes-bench bench                          # embed + relevance + write + search (tiers 1k,10k)
pnpm --filter @my-hub/notes-bench bench:embed                    # cold load, 1000 single calls p50/p95, batch-of-32 lines/s
pnpm --filter @my-hub/notes-bench bench:write -- --writes 200    # remember end to end p50/p95
pnpm --filter @my-hub/notes-bench bench:search -- --tier 10k     # tiers: 1k 10k 50k 100k; concurrency 1,5,10
pnpm --filter @my-hub/notes-bench bench:relevance -- --config hybrid
pnpm --filter @my-hub/notes-bench bench:resolve -- --verbose  # remember subject matching: threshold x floor sweep
pnpm --filter @my-hub/notes-bench bench:lists     # "give me the whole list": items reaching Claude, list note vs. note per item
pnpm --filter @my-hub/notes-bench bench:compare results/a.json results/b.json   # flags regressions (--fail: exit 2)

# against a deployed server (credentials: OAuth client of a bench account, or a bearer token)
export NOTES_BENCH_CLIENT_ID=hub_xxx NOTES_BENCH_CLIENT_SECRET=...
pnpm --filter @my-hub/notes-bench bench:seed -- --target https://mcp.alexiuc.dev --yes      # writes ~230 entries
pnpm --filter @my-hub/notes-bench bench:relevance -- --target https://mcp.alexiuc.dev
pnpm --filter @my-hub/notes-bench bench:search -- --target https://mcp.alexiuc.dev
```

Flags: `--provider e5|ollama|fake`, `--tier`, `--config fts,trigram,vector,hybrid,hybrid-multi`, `--requests N`,
`--concurrency 1,5,10`, `--n N` (embed samples), `--filler N` (relevance with N synthetic entries as noise),
`--docker-container NAME` (also sample that container's memory), `--out DIR`, `--no-save`.

**RAM:** the process RSS in the output is the bench process itself, which in direct mode hosts the model, so it is
close to the server's. For the real container use `--docker-container my-hub-prod-mcp-1` on the VPS or watch
`docker stats` while a `--target` run is going.

## Fixtures

- `fixtures/corpus.txt` -> `fixtures/seed-notes/` (95 hand-written notes, ~230 entries, mixed RO / RU / EN, no real personal data)
- `fixtures/resolve-cases.json` (63 `remember` subjects labelled with the note they must merge into, or `null` = new note;
  near misses like "Summer tires" vs. Winter tires). Used by `resolve` to tune `NOTES_MATCH_THRESHOLD` / `NOTES_MATCH_VECTOR_FLOOR`.
- `fixtures/golden.txt` -> `fixtures/golden-queries.json` (53 queries: `exact`, `vague`, `typo`, `crosslang`, `paraphrase`;
  18 carry the extra phrasings Claude would add, used by `hybrid-multi`)
- Edit the `.txt` sources and run `pnpm --filter @my-hub/notes-bench fixtures` to regenerate (both outputs are committed).
- Scale tiers use deterministic synthetic filler (`bench-filler-*` categories), never the golden notes.
- The seed corpus is ~95 notes, not the ~200 the spec asked for; extend `corpus.txt` as real notes accumulate.

## Reading results

- **With `--provider fake` only the lexical legs (`fts`, `trigram`) mean anything.** The output says so. Real vector and
  hybrid numbers need `e5` (or Ollama).
- `results/` is gitignored except `.gitkeep`; commit a result file deliberately when it is a reference.
