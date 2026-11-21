# Notes MCP: run on Hetzner checklist

Everything below is for the VPS. Sandbox numbers (FakeProvider, 4 vCPU) are in `docs/notes-mcp-spec.md` section 15.

## 0. Before merging (it changes prod compose and the mcp image)

- [ ] `NOTES_DB_PASSWORD` is set in the server's `.env` (prod compose **requires** it; without it `compose up` aborts).
- [ ] `docker volume create my-hub_notes_data` (external volume that holds the Markdown repos; `down -v` can never delete it).
- [ ] The mcp image is now Debian (`node:26-bookworm-slim`) and larger (~+350 MB: onnxruntime, transformers). CI's
      "build-and-push" / e2e job is the first real build of it; watch it.
- [ ] Optional now, needed for backup: `NOTES_GIT_REMOTE` (private repo) plus an SSH key or token the container can use.

## 1. Deploy

1. Merge, let the deploy workflow pull the new `my-hub-mcp-server` image, then `docker compose ... up -d` (or the usual deploy).
2. Pre-seed the model so the first request does not wait: `docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js download-model`.
   It prints `e5/Xenova/multilingual-e5-small ready in N ms`. If it fails with a download error, see the pre-seed section of `packages/notes/README.md`.
3. `docker compose logs mcp | grep "\[notes\] ready"` shows the boot time and provider.
4. In the Hub (`/mcp-control`) enable the **Notes** server for yourself, then add `https://mcp.alexiuc.dev/api/notes/mcp` as a custom connector in claude.ai (OAuth, same as the others).

If `onnxruntime-node` fails to load in the container, fall back to `EMBEDDINGS_PROVIDER=ollama` (plus an `ollama` service) and tell me.

## 2. Benchmarks

The mcp image ships only the production build, so run the bench from a checkout on the VPS. `notes-db` listens on
`127.0.0.1:5433` (loopback only). The bench builds its own schema (`bench_<ts>`) and temp directory and drops them at
the end, so the real notes repo and index are untouched.

```bash
git clone <repo> && cd my-hub && pnpm install
export NOTES_BENCH_DATABASE_URL=postgresql://notes:$NOTES_DB_PASSWORD@127.0.0.1:5433/notes
export EMBEDDINGS_PROVIDER=e5 EMBEDDINGS_CACHE_DIR=$PWD/.model-cache      # downloads the model once
pnpm --filter @my-hub/notes-bench bench -- --tier 1k,10k,50k --docker-container my-hub-prod-mcp-1
pnpm --filter @my-hub/notes-bench bench:search -- --tier 100k            # slow to seed; optional
pnpm --filter @my-hub/notes-bench bench:embed -- --provider e5
```

`--docker-container` also samples the running mcp container's memory (the bench process hosts a second copy of the
model, so its own RSS is the model-in-process cost). To compare against Ollama later: `--provider ollama` with
`EMBEDDINGS_MODEL=bge-m3 EMBEDDINGS_DIMENSIONS=1024 OLLAMA_URL=...`, then `bench:compare` the two files.

Then the transport view through the real endpoint, with a **bench account's** OAuth client (notes are per user, so the
bench account's notes are separate from yours):

```bash
export NOTES_BENCH_CLIENT_ID=hub_xxx NOTES_BENCH_CLIENT_SECRET=...
pnpm --filter @my-hub/notes-bench bench:seed -- --target https://mcp.alexiuc.dev --yes     # writes ~230 entries to that account
pnpm --filter @my-hub/notes-bench bench:relevance -- --target https://mcp.alexiuc.dev
pnpm --filter @my-hub/notes-bench bench:search -- --target https://mcp.alexiuc.dev
```

Results land in `packages/notes-bench/results/<timestamp>-<sha>-<command>-<provider>.json` (gitignored; share the
files back).

## 3. What to send back

The result JSON files (all of `all-e5`, the `--target` relevance and search runs), plus `docker stats` idle RAM of the `mcp` and `notes-db` containers.
