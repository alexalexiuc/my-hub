# Notes MCP — Handover, Spec & Spike Plan

> **For the Claude Code session picking this up:** this file is the full handover. It captures the design discussion so far, the decisions and _why_, the rejected alternatives, environment caveats, and the work plan. You're free to plan and sequence the work however you judge best. Treat §2 decisions as settled unless you hit evidence against them; treat §13 as open. Commit this file to the repo as `docs/notes-mcp-spec.md` and keep it updated as decisions change.

---

## 0. TL;DR

Build a new **Notes MCP server** inside the `my-hub` monorepo: a personal "remember this" index for small practical facts that are easy to forget (which vendor or product was used and how it turned out, a price paid, a how-to). Claude writes/searches it remotely from claude.ai on the phone.

- **Plain Markdown files** are the source of truth (git repo on a volume).
- **Postgres + pgvector + pg_trgm + unaccent** is a disposable search index.
- **Local embedding model** in-process (`multilingual-e5-small`, int8 ONNX, via Transformers.js). No external embedding API.
- **Hybrid search** (full-text + trigram + vector, fused with RRF) so vague, typo'd, or cross-language queries still find the right note.
- First a **spike**: build it, measure latency / RAM / relevance with a **re-runnable benchmark suite**, deploy to Hetzner, measure again, then harden.

## 1. Context

### Owner

Alex Alexiuc — software engineer / team lead, 10+ years. Main stack: TypeScript, NestJS, React, AWS, CDK, SQL, Go. Based in Chișinău, Moldova. Notes will be **mixed Romanian, Russian, and English**.

### The `my-hub` monorepo (github.com/alexalexiuc/my-hub)

- TypeScript / pnpm monorepo.
- Deployed on a **Hetzner VPS** with **Docker Compose + Traefik**.
- Already contains MCP servers for **Finances, Travel, Calories, Apiary** — these are remote MCP servers connected to claude.ai as custom connectors, with OAuth, and used daily from the phone.
- Next.js hub UI at `hub.alexiuc.dev`.
- **Before writing code, read the existing MCP apps** and follow their conventions: app layout, NestJS structure, MCP transport setup, OAuth wiring, compose/Traefik config, migrations, env handling, tests. The new app should look like a sibling, not a stranger.

### How this will be worked on

1. A remote Claude Code session (you) builds Phase 0 and as much of Phase 1–2 as the environment allows, pushes to a branch.
2. Alex deploys to Hetzner and runs the benchmark suite there for real numbers.
3. Results come back, decisions in Phase 3 get made, then production hardening.

## 2. Settled decisions (and why)

| Area             | Decision                                                                                         | Why                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Hosting          | Remote MCP on Hetzner, in my-hub                                                                 | Must work from claude.ai on the phone. Nothing runs on Alex's laptop. Reuses existing OAuth/Traefik. |
| Source of truth  | Markdown files, git repo on a Docker volume                                                      | Human-readable, editable in Obsidian or any editor, diffable, free history.                          |
| Index            | Postgres with `pgvector`, `pg_trgm`, `unaccent`                                                  | One DB for FTS + fuzzy + vectors → hybrid ranking in one place. Index is rebuildable from files.     |
| Embeddings       | `Xenova/multilingual-e5-small`, int8 ONNX, in-process via `@huggingface/transformers` (384 dims) | Free, private, multilingual (RO/RU/EN), ~120 MB, fast on CPU, no extra container.                    |
| Search           | Hybrid: FTS + trigram + vector, fused with RRF                                                   | "Google-like": finds things not literally in the query, survives typos and language mixing.          |
| Query expansion  | Done by Claude, not the server: `search` takes `queries: string[]`                               | The calling LLM is a better query expander than anything we'd build.                                 |
| Writes           | Explicit by default; Claude may offer to save (draft policy §8)                                  | Fully automatic writes would fill the store with noise.                                              |
| Backup           | Daily `git push` of the notes repo to a private GitHub repo                                      | Tiny data, free, versioned. DB not backed up.                                                        |
| Scope of content | Practical facts about _things and services_                                                      | Not personal/biographical facts about Alex. Claude's own built-in memory covers those.               |

### Rejected alternatives (don't re-litigate without new evidence)

- **Off-the-shelf memory MCP servers.** Basic Memory has the right idea (Markdown + SQLite) but no auth when self-hosted, so it's unusable as a phone connector without wrapping. mcp-memory-service and Memlord have OAuth but are generic memory engines that don't model "A vs B, which was better" and are another third-party service to patch. The official `@modelcontextprotocol/server-memory` is too basic.
- **Qdrant.** Alex used it in a previous project (AI Co-Reader). Unnecessary here: it means a second DB and merging results in app code, and its strengths (millions of vectors, payload filtering at scale) aren't needed.
- **Big local LLM for embeddings** (e.g. Phi-4 via Ollama, as in Co-Reader). ~14B params, ~10 GB RAM, slow on CPU, worse at retrieval than a dedicated embedding model.
- **OpenAI embeddings.** Fine quality and near-zero cost, but notes leave the server, it adds an API key and internet dependency, and switching models later means re-embedding. Keep as a fallback only.
- **Native vectors in Postgres core.** PostgreSQL 19 (GA 2026-11-19) did **not** add a native vector type. Its headline additions are things like SQL/PGQ property-graph queries and async I/O improvements. pgvector is still the way.

### Kept as a benchmark alternative

**Ollama container** with a small embedding model (`embeddinggemma` ~300M or `bge-m3` ~570M), called via `POST /api/embed`. Benchmark it against in-process e5 if e5's relevance disappoints. Hide embeddings behind an interface so swapping is one config change.

## 3. Environment caveats (important for a remote session)

Observed from a similar cloud workspace; verify in yours early:

- **Hugging Face downloads may be blocked** by the sandbox network allowlist (`huggingface.co` returned 403 via the proxy). You may not be able to load the real e5 model in the remote session.
- **npm registry works.** GitHub is reachable for git operations.
- **Docker daemon may not be running.** `docker` CLI may exist without a socket. Try starting `dockerd`. If that fails, install Postgres + pgvector via apt (e.g. `postgresql-XX-pgvector`) or build pgvector from source from GitHub. Don't depend on Testcontainers.
- **CPU/RAM of the sandbox ≠ the Hetzner VPS.** Latency numbers from the sandbox are only indicative. Real numbers come from Hetzner.

Design for this:

- **`EmbeddingProvider` interface** with implementations:
  - `E5LocalProvider`: real model, Transformers.js.
  - `OllamaProvider`: optional, for comparison.
  - `FakeProvider`: deterministic hash-based vectors for unit tests/CI and for environments without model access. Clearly marked: relevance numbers from it are meaningless.
- Select via env (`EMBEDDINGS_PROVIDER=e5|ollama|fake`). The benchmark output must record which provider was used.
- **Model weights:** download at Docker image build time or into a cached volume on first boot (`TRANSFORMERS_CACHE` / `env.cacheDir`), never on every start. Support a local model path env var so weights can be pre-seeded.
- If the real model can't be loaded in the session, still build and test everything with `FakeProvider`, and make sure `pnpm bench` runs end-to-end on Hetzner with `e5`.

## 4. Note file format

One file per subject, one folder per category.

```
notes/
  services/carpet-cleaning.md
  home/washing-detergent.md
  car/engine-oil.md
```

```markdown
---
title: Carpet cleaning
category: services
tags: [home, cleaning]
aliases: [rug cleaning, covoare, curățare covoare, химчистка ковров]
updated: 2026-11-21
---

- 2026-11-21 [contact] CleanPro, 069xxxxxx, picked up from the flat ^k3f9
- 2026-11-21 [price] 450 MDL for 3 rugs ^p2a1
- 2026-11-28 [verdict] Good result, smell gone, would use again ^v8c4
```

Rules:

- Entry line: `- YYYY-MM-DD [type] text #optional-tags ^id`
- `type` ∈ `fact | verdict | contact | price | how-to` (fixed list for now, see §13).
- `^id` = short stable random ID (Obsidian block-ref style), unique within the file, so entries can be edited/deleted precisely.
- Free-form text between frontmatter and entries (e.g. a short description) is allowed and should be preserved and indexed, but Claude only appends or edits single entry lines. It never rewrites a whole file.
- Slugs: lowercase, ASCII, hyphenated (transliterate RO/RU titles for the filename; keep the original in `title`/`aliases`).
- Every write = one git commit, e.g. `notes(services/carpet-cleaning): +entry ^v8c4`.
- Parser must round-trip: parse → serialize must not change a file it didn't edit (whitespace, unknown frontmatter keys, comments).

## 5. Architecture

```
docker compose
├── notes-mcp   NestJS + MCP (streamable HTTP) + embedding provider
│               volume: notes repo (git)
│               model cache volume
└── postgres    image: pgvector/pgvector (pg18; pg19 when the image is available)
```

- Match the existing my-hub MCP apps for transport, OAuth, and Traefik routing. OAuth can be stubbed/disabled locally for the spike but must be wired before connecting to claude.ai.
- Set compose resource limits that mirror the VPS (e.g. `cpus: 2`, `mem_limit: 2g` for notes-mcp) so local and remote numbers are comparable. Check the actual VPS size and existing services' footprint first.
- Load the embedding pipeline once at boot (singleton). Report readiness only after the model is loaded.
- Serialize writes per file (simple mutex/queue) to avoid git/index races.

## 6. Database schema (starting point)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE notes (
  id             bigserial PRIMARY KEY,
  path           text UNIQUE NOT NULL,
  title          text NOT NULL,
  category       text NOT NULL,
  tags           text[] NOT NULL DEFAULT '{}',
  aliases        text[] NOT NULL DEFAULT '{}',
  names          text NOT NULL,        -- unaccent(lower(title || ' ' || aliases...)), maintained by app
  name_embedding vector(384),          -- embedding of title + aliases
  content_hash   text NOT NULL,
  updated_at     timestamptz NOT NULL
);

CREATE TABLE entries (
  id          bigserial PRIMARY KEY,
  note_id     bigint NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entry_key   text NOT NULL,           -- the ^id
  entry_date  date,
  type        text NOT NULL,
  text        text NOT NULL,
  line_hash   text NOT NULL,           -- skip re-embedding unchanged lines
  tsv         tsvector NOT NULL,       -- to_tsvector('simple', unaccent(text)), see note
  embedding   vector(384) NOT NULL,
  UNIQUE (note_id, entry_key)
);

CREATE INDEX entries_tsv_idx  ON entries USING gin (tsv);
CREATE INDEX notes_names_trgm ON notes   USING gin (names gin_trgm_ops);
-- Optional once entries > ~20k (benchmark decides):
-- CREATE INDEX entries_vec_idx ON entries USING hnsw (embedding vector_cosine_ops);
```

Notes:

- `unaccent()` is not IMMUTABLE, so it can't go in a generated column directly. Either maintain `tsv`/`names` in the app, or wrap it in an IMMUTABLE SQL function (common pattern: `immutable_unaccent(text)` using `unaccent('unaccent', $1)`).
- Use the `'simple'` text-search config (no stemming), because notes are multilingual. The vector leg covers morphology and synonyms.
- Index the free-text body (non-entry text) too, either as a pseudo-entry or a separate column.
- Vector dimension depends on the provider (384 for e5-small, 1024 for bge-m3, 768 for embeddinggemma). Make it configurable, and make the reindex command able to recreate the column.

## 7. Search pipeline

Input: `queries: string[]` (1–5), optional `category`, `limit` (default 5).

Per query:

1. **FTS leg:** `websearch_to_tsquery('simple', unaccent(q))` on `entries.tsv`, rank `ts_rank_cd`, top 50.
2. **Trigram leg:** `similarity(notes.names, unaccent(lower(q)))` (or `word_similarity`), top 20 notes. Catches typos ("clenpro") and partial names.
3. **Vector leg:** embed `'query: ' + q` (e5 prefix convention), cosine distance `<=>` on `entries.embedding` (top 50) and `notes.name_embedding` (top 20).

Fuse every leg × every query with **Reciprocal Rank Fusion**:

```
score(doc) = Σ_legs Σ_queries  1 / (k + rank),  k = 60 (tunable)
```

Aggregate entry scores to their note. Return the top `limit` notes:

- `path`, `title`, `category`, `score`
- top 3 matching entry lines (with `^id`, date, type) as snippets
- `matched_by`: which legs hit (useful for tuning; can be hidden later)

Goals: one `search` call usually answers the question without a `read`. Embed all query variants in one batch call.

e5 conventions: `passage: ` prefix for stored text, `query: ` for search text, mean pooling, L2-normalize.

## 8. MCP tools

| Tool                                                    | Purpose                                                                                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search(queries[], category?, limit?)`                  | Hybrid search (§7)                                                                                                                                                                                         |
| `read(path)`                                            | Full note                                                                                                                                                                                                  |
| `remember(subject, text, type, tags?, aliases?, date?)` | Resolve `subject` → existing note (trigram on names + name-embedding similarity above a threshold), append entry. Otherwise create a new note. Returns `{ path, title, created, entry_id, matched_score }` |
| `edit_entry(path, entry_id, text, type?)`               | Fix one line                                                                                                                                                                                               |
| `delete_entry(path, entry_id)`                          | Remove one line                                                                                                                                                                                            |
| `add_alias(path, alias)`                                | Teach the index another name                                                                                                                                                                               |
| `recent(limit?)` / `list(category?)`                    | Browse                                                                                                                                                                                                     |
| (admin, not MCP) `reindex`                              | Rebuild DB from files; CLI/HTTP admin endpoint                                                                                                                                                             |

`remember` edge cases: when the match is ambiguous (two notes close to the threshold), return candidates instead of guessing, and let Claude pick and retry with a `path` argument. Consider an optional `path` param that skips resolution.

### Draft tool-description policy (to be refined after real use)

- Write when the user explicitly asks ("remember", "note that", "add to my notes", "save this").
- When the user states a durable practical fact (a vendor used, a product verdict, a price paid, a part spec or size), **offer in one short line** to save it. Never save silently.
- Scope: facts about things and services, not personal or biographical facts about the user.
- Before `remember`, it's fine to `search` first to avoid duplicates. Prefer appending to an existing note.
- Always pass 2–4 query variants to `search`, including RO/RU/EN translations and synonyms when relevant.
- After `remember` with `created: true`, tell the user the new note's title.

Tool descriptions matter as much as code here. Write them carefully, with an example in each.

## 9. Indexing

- **On write:** update file → git commit → upsert the note row → embed and upsert only changed entries (`line_hash`) → delete removed entries.
- **On startup:** walk the notes dir, compare `content_hash`, reindex changed files, drop rows for deleted files.
- **Manual edits** (Obsidian, `git pull`): picked up on startup or via `reindex`. A file watcher is optional and can come later.
- **Notes repo init:** if the volume is empty, `git init` it. A remote (private GitHub repo) is configured via env. The push job is a separate concern (cron/systemd timer or an in-app scheduler); a failed push must not block writes.

## 10. Work plan

You decide sequencing and granularity. This is the intended shape.

### Phase 0: skeleton

- Read the existing my-hub MCP apps; mirror their conventions.
- `apps/notes-mcp` (or whatever the repo's naming convention is) + compose service + Postgres with pgvector.
- Markdown parser/serializer with round-trip tests.
- `EmbeddingProvider` interface + `e5` / `fake` (+ optional `ollama`) providers.
- Migrations, indexer, reindex command.
- MCP tools from §8 over streamable HTTP. Auth stubbed locally, following the existing pattern.
- Unit tests (parser, slugging, RRF fusion, remember resolution) + integration tests against real Postgres.

### Phase 1: performance measurement

Run with container limits matching the VPS. Initial targets (adjust once real data exists):

| Metric                        | How                                            | Initial target      |
| ----------------------------- | ---------------------------------------------- | ------------------- |
| Model cold load               | boot → first embedding                         | < 5 s               |
| RAM idle / peak (notes-mcp)   | sample `docker stats` (or `/proc`) during runs | < 600 MB peak       |
| Embed latency, one short line | 1,000 single calls, p50/p95                    | p95 < 50 ms         |
| Embed throughput              | batches of 32, lines/sec                       | sizing for reindex  |
| `remember` end-to-end         | file + commit + embed + upsert, p50/p95        | p95 < 300 ms        |
| `search` (4 query variants)   | at 1k / 10k / 50k / 100k entries, p50/p95      | p95 < 150 ms at 10k |
| Full reindex                  | wipe DB → rebuild, at 10k entries              | < 2 min             |
| Concurrency                   | 5–10 parallel search clients                   | p95 doesn't blow up |

Realistic scale: ~20 notes/day for 10 years ≈ 73k entries is the extreme upper bound. Expect a few thousand.

### Phase 2: relevance evaluation

- **Golden set:** 40–60 queries → expected note path. Mix exact, vague ("who washed our rugs"), typo ("clenpro"), and cross-language ("ulei motor" → `car/engine-oil.md`, "порошок" → `home/washing-detergent.md`) cases. Tag each with `kind` and `lang`.
- **Seed corpus:** ~200 realistic notes across categories (home, car, services, appliances, garden, health-neutral household items, shops), in mixed RO/RU/EN. Plus synthetic filler for scale tiers. Keep fixtures in the repo.
- **Metrics:** recall@1, recall@5, MRR.
- **Compare configs:** FTS only · trigram only · vector only · hybrid · hybrid with 1 vs 4 query variants · e5-small vs Ollama bge-m3 / embeddinggemma.
- With `FakeProvider`, only the non-vector legs give meaningful relevance numbers. Say so in the output.

### Phase 3: decide (with Alex, after Hetzner numbers)

- In-process e5 vs Ollama?
- HNSW index needed?
- RRF `k`, leg weights, `remember` match threshold.
- Then: real OAuth, Traefik route, notes-repo backup push, connect as a claude.ai custom connector, finalize tool descriptions.

## 11. Benchmark suite (separate, re-runnable)

Lives apart from the app so it can be run any time against local or production:

```
packages/notes-bench/
  fixtures/
    corpus.txt               # realistic corpus, one compact file; turned into Markdown notes at run time
    golden.txt               # query => expected note title (+ lang, kind, extra phrasings)
  src/
    seed.ts                  # build scale tiers (1k/10k/50k/100k entries)
    bench-embed.ts           # embed latency + throughput
    bench-write.ts           # remember end-to-end
    bench-search.ts          # search latency per tier + concurrency
    bench-relevance.ts       # recall@k, MRR per config
    sample-resources.ts      # memory/CPU sampler during runs
    compare.ts               # diff two result files, flag regressions
  results/                   # committed or gitignored, Alex's call; keep a .gitkeep
```

- Each run writes one JSON file: timestamp, git SHA, host, CPU/RAM limits, embedding provider + model, DB version, all metrics.
- Commands: `pnpm bench` (all), `pnpm bench:search --tier 10k`, `pnpm bench:relevance --config hybrid`, `pnpm bench:compare <a.json> <b.json>`.
- `--target <url>` so the same suite runs against local compose or the Hetzner deployment. Calls go through the real MCP HTTP endpoint (JSON-RPC), so numbers include transport. Also return server-side timings (e.g. a `timings` field or header) to separate network from compute.
- Seeding must not touch the real notes repo. Use a separate notes dir/DB schema per bench run, or a `--bench` mode, and clean up afterwards.
- Also print a short human-readable summary table to stdout.

## 12. Sizing facts (already discussed)

- One entry ≈ 100–300 bytes. Even the 10-year extreme is ~15–20 MB of text, ~3–5 MB gzipped. Backups are effectively free.
- Embeddings live only in the DB (~1.5 KB/entry at 384-dim float32) and are rebuildable, so they're never backed up.
- The only thing that could make storage large is attachments (photos). Out of scope.

## 13. Open questions

- Explicit-only writes vs "offer to save": finalize after a week of real use.
- Fixed entry types vs free types.
- Should `search` return notes or entries as the primary unit? (Start with notes + top entries.)
- Postgres 18 vs 19 image.
- Results folder committed or gitignored.
- Hub UI: a simple browse/search page at hub.alexiuc.dev later? Not in the spike.
- (from the spike) HNSW index and its filter interaction (`user_id`, `category` are post-filters); batch inserts for reindex.
- (from the spike) Minimum similarity for the vector legs; `remember` thresholds; RRF `k` and leg weights; per-leg timings in `notes_search` output.
- (from the spike) Wire notes into Hub "Delete all my data"; schedule the backup push; add an `ollama` compose service when benchmarking it.

## 14. Definition of done for this session

- Branch pushed with: notes-mcp app, compose changes, migrations, tests passing, notes-bench package, and this doc updated with anything that changed.
- `README` in the app: how to run locally, env vars, how to run benchmarks against local and remote, how to switch embedding providers, how to reindex.
- A short **"Run on Hetzner" checklist** for Alex: deploy, pre-seed model cache, run `pnpm bench --target …`, where results land.
- A summary of any numbers you could measure in the sandbox, clearly labelled as sandbox and provider used, plus anything you couldn't verify because of environment limits.

---

## 15. Spike status (added by the implementing session)

### What exists

| Piece                                                                                                                                                         | Where                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Core library: parser (byte-exact round trip), git store + write queue, embeddings (e5 / ollama / fake), schema, indexer, hybrid search, exact-name match, CLI | `packages/notes`                                                                                                                     |
| MCP tools (11: search, read, remember, edit/delete entry, add alias, recent, browse, review duplicates, merge, mark reviewed) on `/api/notes/mcp`             | `packages/mcp-server/src/notes`                                                                                                      |
| Benchmarks + fixtures (95 notes, 53 golden queries)                                                                                                           | `packages/notes-bench`                                                                                                               |
| Compose (`notes-db`, volumes, limits), mcp Dockerfile, CI pgvector service, e2e spec                                                                          | `infra/`, `packages/mcp-server/Dockerfile`, `.github/workflows/ci.yml`, `packages/mcp-server/e2e/notes.e2e.ts`                       |
| Docs                                                                                                                                                          | `packages/notes/README.md`, `packages/notes-bench/README.md`, `docs/notes-mcp-hetzner.md`, `docs/requirements/mcps/feature-notes.md` |

### Deviations from this handover (and why)

1. **Not a NestJS app and not a separate container.** The repo is Fastify with one `mcp-server` hosting all sub-servers
   behind one OAuth issuer, the Hub's enable/disable control and one Traefik route. Notes is a sub-server
   (`McpServerNames.Notes`) there; the heavy logic is in its own package (`@my-hub/notes`) so it can be split into its own
   service later without rewriting. Cost: the embedding model (~300-500 MB RSS) lives in the same process as the other
   MCPs; compose limits (`MCP_CPUS`, `MCP_MEM_LIMIT`, default 2 CPUs / 2 GB) cover it.
2. **Own Postgres, not the Drizzle DB.** `notes-db` (`pgvector/pgvector:pg18`) avoids swapping the production DB image.
   Notes tables are raw SQL in `packages/notes/src/db.ts` (the index is disposable; the schema version rebuilds it).
3. **Tool names are prefixed** (`notes_search`...) per the repo's `<domain>_<intent>` convention.
4. **Per-user stores.** Files at `<NOTES_ROOT>/<userId>/`, index rows keyed by `user_id`. One user never sees another's notes.
5. **A fourth search leg: trigram on entry text.** Section 7 only had trigram on note names, but the spec's own typo example
   ("clenpro" -> CleanPro, which is a vendor named inside an entry, not in the title) needs it. Legs are switchable per request
   (`legs`) so the benchmark can compare. Entry score per note = sum of its best 3 entries' RRF scores, plus the note-name RRF score.
6. **`remember` matches exactly, never fuzzily** (changed on 2026-11-21, see "Raw writes and a review pass" below). It appends to the
   note whose title or an alias equals the subject after case and accent folding (most recently updated wins); otherwise it
   creates a new note marked `reviewed: false`. Near-duplicates are allowed and merged later by Claude in an explicit review pass
   (`notes_review_duplicates` -> `notes_merge` -> `notes_mark_reviewed`). Optional `path` writes to exactly that note; optional
   `category` names the folder of a new note (default `misc`). The fuzzy matcher (trigram + name embedding, `NOTES_MATCH_*`) is gone.
7. **Debian base image for mcp** (`node:26-bookworm-slim`) because onnxruntime-node ships glibc binaries only. `pnpm-workspace.yaml`
   sets `onnxruntime-node: false` in `allowBuilds` (its postinstall only fetches optional CUDA libraries; the CPU binaries ship in the package).
8. **Benchmark modes.** Direct mode (isolated schema + temp dir) covers everything; `--target` mode covers `search` and `relevance`
   through the real MCP endpoint. `embed` and `write` are in-process by nature.
9. **Hub "Delete all my data" does not yet remove notes** (the notes live outside the Drizzle DB). `notes-cli purge <userId>` does it by hand; wiring is listed in section 13.

### Verified in the sandbox

- 35 unit tests (parser round trips incl. CRLF / no trailing newline / no frontmatter, slugs, RRF, resolution) and 15 integration tests (real Postgres 16 + pgvector 0.6.0, `FakeProvider`) pass.
- `packages/mcp-server/e2e/notes.e2e.ts` (8 tests) passes over the real MCP protocol with OAuth against a locally started server; `notes-bench` direct and `--target` modes run end to end.
- Compose files validate with `docker compose config`.

### Verified locally (2026-11-21, Windows 11 dev box, real e5)

- **The real model works**: `E5LocalProvider` downloads `Xenova/multilingual-e5-small` (q8, ~120 MB) and produces 384-dim vectors, on Windows and in the Linux image.
- **The mcp image builds** (`docker build -f packages/mcp-server/Dockerfile .`, 1.06 GB) and `node node_modules/@my-hub/notes/dist/cli.js download-model`
  works inside it on a fresh named volume as user `node`: 48.4 s with the download, 764 ms once cached. onnxruntime-node loads on bookworm-slim.
- Unit + integration tests (50) pass against `pgvector/pgvector:pg18`.
- Fixed on the way: `CREATE EXTENSION` now pins `SCHEMA public`. Unpinned, the extensions landed in the first schema on the search path
  (a bench schema), so a second bench schema could not see `unaccent`, and the bench's `DROP SCHEMA ... CASCADE` dropped the extensions again.
  `.model-cache` is now gitignored and dockerignored.

### NOT verified yet

- **Hetzner after deploy**: `--target` runs through the real endpoint, idle RAM of the `mcp` (with the model) and `notes-db` containers.
  The direct-mode VPS run is done (next section).
- **CI changes** (pgvector service container, staging compose with the fake provider) and **the prod compose** have not run.

### Real e5 numbers on the Hetzner VPS (2026-11-21)

Host: 2 vCPU AMD EPYC Genoa, 3.8 GB RAM, shared with the running prod stack. The bench ran in a `node:26-bookworm-slim` container capped
like the mcp service (`--cpus 2 --memory 2g`), against a throwaway `pgvector/pgvector:pg18` on loopback, before the merge, so prod was not touched.

- **Embedding**: cold load 1.4 s from cache; single line p50 5.6 ms / p95 7.3 ms; 303 lines/s in batches of 32. Bench process RSS 112 MB idle,
  **734 MB peak** with the model loaded and 50k entries indexed: fits the 2 GB mcp limit, but it is most of the box's ~2.6 GB of free RAM.
- **`remember`** end to end: p50 72 ms / p95 81 ms / p99 91 ms (target p95 < 300 ms: met easily).
- **Indexing**: 1k entries 6.3 s, 10k 57 s, 50k 300 s (~170 entries/s).
- **`search`** (4 phrasings per request), wall ms:

| Entries | conc. 1 p50 / p95 | conc. 5 p95 | conc. 10 p95 |
| ------- | ----------------- | ----------- | ------------ |
| 1k      | 56 / 76           | 338         | 599          |
| 10k     | 124 / **173**     | 792         | 1259         |
| 50k     | 270 / 370         | 1981        | 3602         |

**The target p95 < 150 ms at 10k is missed even one request at a time** (173 ms), and concurrency scales almost linearly with 2 cores.
One user rarely sends parallel searches, but Claude does send several phrasings at once. This makes the HNSW / fewer-legs decision (section 13)
the next piece of work; it is not needed for a personal corpus of a few hundred to a few thousand entries (1k: p95 76 ms).

- **Relevance and `remember` matching**: identical to the dev box (both deterministic): hybrid 0.81 / 0.94 / 0.86, hybrid-multi 0.93 / 0.98 / 0.95,
  with 5,000 filler entries hybrid 0.60 / 0.83 / 0.71; the old fuzzy resolver at 0.75 / 0.6 45 correct, 0 wrong merges, 17 missed, 1 ambiguous (since replaced, see below).
- **Prod baseline before Notes**: `my-hub-mcp-1` idles at 89 MB. After deploy expect roughly +500-650 MB once the model is loaded (`NOTES_WARM_ON_BOOT`).

### Real e5 numbers (dev box: i7-12700H, 20 threads, 16 GB, no container limits, Postgres 18 in Docker Desktop)

Not the VPS: no CPU limit, a much faster CPU, Docker Desktop's VM in between. Re-run on Hetzner before deciding anything about capacity.

- **Embedding**: cold load 0.8 s from cache (42.7 s with the first download); single line p50 3.4 ms / p95 4.9 ms; 746 lines/s in batches of 32.
  Process RSS 98-113 MB idle before the model, **~640 MB peak** with the model loaded (vs. 155 MB with the fake provider).
- **`remember`** end to end: p50 153 ms / p95 168 ms / p99 459 ms over 100 writes (target p95 < 300 ms; git on Windows is part of this).
- **Indexing**: 1k entries 6.0 s, 10k 63 s, 50k 334 s (~150 entries/s, now embedding-bound instead of insert-bound).
- **`search`** (4 phrasings per request, embedding ~8 ms of it):

| Entries | conc. 1 p50 / p95 | conc. 5 p95 | conc. 10 p95 | req/s at conc. 1 |
| ------- | ----------------- | ----------- | ------------ | ---------------- |
| 1k      | 30.5 / 50.7       | 148         | 255          | 30.5             |
| 10k     | 51.4 / 74.1       | 267         | 507          | 19.2             |
| 50k     | 95.7 / 150.0      | 693         | 1026         | 9.6              |

Same shape as the sandbox: fine one at a time, and the DB part (≥ 85% of server time) grows with concurrency. HNSW is still the open decision.

- **Relevance** (53 golden queries, recall@1 / recall@5 / MRR):

| Config       | seed corpus only   | + 5,000 filler entries |
| ------------ | ------------------ | ---------------------- |
| fts          | 0.30 / 0.38 / 0.35 | 0.17 / 0.25 / 0.21     |
| trigram      | 0.60 / 0.68 / 0.64 | 0.53 / 0.62 / 0.57     |
| vector       | 0.45 / 0.85 / 0.62 | 0.40 / 0.66 / 0.50     |
| hybrid       | 0.81 / 0.94 / 0.86 | 0.60 / 0.83 / 0.71     |
| hybrid-multi | 0.93 / 0.98 / 0.95 | 0.74 / 0.87 / 0.80     |

The real model lifts hybrid from 0.53 / 0.83 / 0.66 (fake) to 0.81 / 0.94 / 0.86, and multiple phrasings still add the most (recall@1 0.81 -> 0.93).
Noise hurts every leg; the filler is synthetic and shares vocabulary with the corpus on purpose, so it is a pessimistic case.

- **Old fuzzy `remember` subject matching (superseded, kept for the record)** (`bench:resolve`, 63 labelled subjects: 40 that must merge, incl. typos and RU/RO names; 23 that must be new,
  14 of them near misses such as "Summer tires" vs. Winter tires, "Gearbox oil" vs. Engine oil). e5 cosines between short names sit in
  0.82-0.93 for related **and** unrelated pairs: the best wrong note for a near miss reaches 0.91 (Fuel filter -> Air filter) while some right
  answers score 0.86. No cosine cut separates them, so names need trigram or a very high cosine. Sweeping floor 0.6-0.88 x threshold 0.4-0.8:

| Floor / threshold            | correct | wrong merge | missed merge (new duplicate note) | ambiguous |
| ---------------------------- | ------- | ----------- | --------------------------------- | --------- |
| 0.8 / 0.6 (old guess)        | 42      | 1           | 20                                | 0         |
| **0.6 / 0.75 (new default)** | 45      | 0           | 17                                | 1         |
| 0.7 / 0.6 (best single cell) | 52      | 0           | 4                                 | 7         |

Chosen: `NOTES_MATCH_THRESHOLD` 0.75, `NOTES_MATCH_VECTOR_FLOOR` 0.6, i.e. a match needs trigram >= 0.75 on a name or cosine >= 0.9.
Threshold 0.75 has zero wrong merges at **every** floor, while the cells with more correct answers (e.g. 0.7 / 0.6) sit next to cells with
1-6 wrong merges: with 63 cases they would be overfit. A wrong merge silently mixes two subjects; a missed merge only makes a second note that
search still finds and an alias can fix later, so the conservative side is the right one. Better recall here needs a relative signal
(margin over the runner-up) or Claude confirming, not a different absolute cut.

### Raw writes and a review pass (2026-11-21, replaces fuzzy matching)

The fuzzy resolver above looked safe on single subjects, but `bench:lists` (three lists of 12-20 items: places in Chișinău, foods,
cities, each saved either as one list note or as one note per item) showed what it does to lists: at 0.6 / 0.75 it made **7 wrong merges**
(Budapest into Bucharest, Sala cu Orgă into Arcul de Triumf, ...). Short, related names are exactly where name embeddings are least
discriminative. So writes no longer guess:

- `remember` appends only on an exact name match, else creates a new note with `reviewed: false`. Raw notes, predictable writes.
- `notes_browse` returns note **headers** (title, category, aliases, tags, entry count, first line), filtered by category / tag /
  `updatedSince` / unreviewed, optionally ranked by queries, up to 200. "Give me my whole list" = browse, pick headers, `notes_read`.
- `notes_review_duplicates` (only when the user asks to tidy) returns unreviewed notes with their 5 most similar notes (hybrid search on
  title + aliases); Claude merges true duplicates with `notes_merge` and marks the rest with `notes_mark_reviewed`. Notes without the
  `reviewed` key count as reviewed. Index `SCHEMA_VERSION` 3 adds `reviewed` and the frontmatter `updated` date.

`bench:resolve` now measures review suggestions (e5, same 63 subjects): every case either appends on an exact name or becomes a new note,
and for new notes the right existing note is in `similar`:

| kind         | cases | appended (exact) | wrong append | new note | similar @1 | @<=3  | @<=5  |
| ------------ | ----- | ---------------- | ------------ | -------- | ---------- | ----- | ----- |
| exact        | 4     | 4                | 0            | 0        | -          | -     | -     |
| variant      | 25    | 1                | 0            | 24       | 17/24      | 21/24 | 24/24 |
| crosslang    | 4     | 0                | 0            | 4        | 4/4        | 4/4   | 4/4   |
| paraphrase   | 4     | 0                | 0            | 4        | 3/4        | 3/4   | 4/4   |
| typo         | 3     | 0                | 0            | 3        | 3/3        | 3/3   | 3/3   |
| all positive | 40    | 5                | 0            | 35       | 27/35      | 31/35 | 35/35 |

The 23 must-be-new subjects all became new notes (0 wrong appends); their top suggestions score 0.04-0.11 RRF (Gearbox oil -> Engine oil,
Coffee grinder -> Coffee machine), which Claude sees and leaves alone. The duplicate is always within the top 5 for the review pass.

`bench:lists` (e5), items of the list that reach Claude:

| shape | list            | notes | search 5 | search 20 | search 5 + read | search 20 + read | browse q (50) + read | browse category |
| ----- | --------------- | ----- | -------- | --------- | --------------- | ---------------- | -------------------- | --------------- |
| list  | chisinau-places | 1     | 3/20     | 3/20      | 20/20           | 20/20            | 20/20                | 1/20 (1 header) |
| list  | foods-to-try    | 1     | 3/15     | 3/15      | 15/15           | 15/15            | 15/15                | 1/15 (1 header) |
| list  | cities-to-visit | 1     | 3/12     | 3/12      | 12/12           | 12/12            | 12/12                | 1/12 (1 header) |
| notes | chisinau-places | 20    | 4/20     | 13/20     | 4/20            | 13/20            | 20/20                | 20/20           |
| notes | foods-to-try    | 15    | 4/15     | 13/15     | 4/15            | 13/15            | 15/15                | 15/15           |
| notes | cities-to-visit | 12    | 0/12     | 4/12      | 0/12            | 4/12             | 12/12                | 12/12           |

With browse, both shapes return the whole list, and no saves were merged wrongly. Search alone was never enough for lists. So the tool
descriptions no longer give collections a special shape: Claude picks the subject, and browse finds the items either way.

- Everything in the next section is from the sandbox with `FakeProvider`: it excludes real model inference, and the host (4 vCPU Xeon @ 2.1 GHz, 16 GB, no container limits, bench client and Postgres 16 / pgvector 0.6.0 sharing the cores) is not the VPS.

### Sandbox numbers (FakeProvider, 384-dim vectors, Postgres 16, sequential-scan vector legs, no HNSW)

`search` with 4 distinct queries per request (20 SQL statements), wall time in ms, in-process (no transport):

| Entries | conc. 1 p50 / p95 | conc. 5 p95 | conc. 10 p95 | req/s at conc. 1 |
| ------- | ----------------- | ----------- | ------------ | ---------------- |
| 1k      | 29.5 / 39.7       | 159         | 278          | 32.6             |
| 10k     | 69.3 / 108.0      | 403         | 832          | 13.4             |
| 50k     | 269.6 / 423.4     | 1790        | 2965         | 3.6              |

- Target "p95 < 150 ms at 10k" is met sequentially (108 ms) but not under concurrency (403 ms at 5 clients, 832 ms at 10): every request fans out into
  20 statements that each scan a table. At 50k a single request is already ~420 ms. Per leg at 10k (EXPLAIN ANALYZE): vector over entries ~21 ms, note-name
  trigram ~22 ms, FTS ~12 ms, entry trigram ~5 ms. So the **HNSW decision is real** well before 100k, and the note-name trigram leg and the OR-ed FTS query
  are the next things to look at; run the same tiers on the VPS before deciding.
- `remember` end to end (resolve + file + git commit + embed + upsert): p50 39 ms / p95 47 ms over 100 writes on the 95-note corpus (fake embedding ~0.1 ms;
  add the real model's per-line latency). Target p95 < 300 ms leaves room for the model.
- Indexing throughput: 50k entries in 114 s (~440 entries/s, insert-bound, one INSERT per entry); a 10k-entry full reindex is ~26 s plus embedding time
  (real e5 batch throughput is unknown here). Batching the inserts per file is an easy win if reindex time matters.
- Fake embedding: ~0.1 ms single line, ~7,300 lines/s in batches; process RSS 109 MB idle, 155 MB peak (the real model adds several hundred MB; not measurable here).
- Relevance on 53 golden queries (`fts` / `trigram` are meaningful, `vector` / `hybrid` are not with the fake provider): recall@1 / recall@5 / MRR: fts 0.30 / 0.38 / 0.35,
  trigram 0.60 / 0.68 / 0.64, vector (fake) 0.23 / 0.55 / 0.35, hybrid 0.53 / 0.83 / 0.66, hybrid with multiple phrasings 0.79 / 0.96 / 0.87.
  Even with a model that has no semantics, sending several phrasings lifts recall@5 from 0.83 to 0.96, which supports settled decision "query expansion by Claude".
  Over the MCP endpoint (OAuth, JSON-RPC) the same configs return the same numbers.

### Findings worth knowing

- The vector legs always return the nearest neighbours, even for a query that matches nothing, so `search` has no "found nothing" signal other than `matchedBy`
  and low scores. The tool description tells Claude to say so; a similarity cut-off should be calibrated on real e5 scores (section 13).
- `remember` no longer resolves fuzzily (see "Raw writes and a review pass"): a wrong merge silently mixes two subjects, while a duplicate
  note is visible and cheap to merge later. Re-run `bench:resolve` (review-suggestion recall) and `bench:lists` when the model or search changes.
