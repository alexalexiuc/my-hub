# Notes MCP: run on Hetzner checklist

Everything below is for the VPS. Sandbox numbers (FakeProvider, 4 vCPU) are in `docs/notes-mcp-spec.md` section 15.

## 0. Before merging (it changes prod compose and the mcp image)

- [x] `NOTES_DB_PASSWORD` is set in the server's `.env` (prod compose **requires** it; without it `compose up` aborts). Done 2026-11-21
      (random hex, so it needs no URL escaping in `NOTES_DATABASE_URL`).
- [x] `docker volume create my-hub_notes_data` (external volume that holds the Markdown repos; `down -v` can never delete it). Done 2026-11-21.
- [ ] The mcp image is now Debian (`node:26-bookworm-slim`), 1.06 GB built locally (onnxruntime, transformers). It builds and
      `download-model` works in it; CI's "build-and-push" / e2e job is its first CI build, watch it.
- [ ] Optional now, needed for backup: `NOTES_GIT_REMOTE` (private repo) plus an SSH key or token the container can use.

## 1. Deploy

1. Merge, let the deploy workflow pull the new `my-hub-mcp-server` image, then `docker compose ... up -d` (or the usual deploy).
2. Pre-seed the model so the first request does not wait: `docker compose exec mcp node node_modules/@my-hub/notes/dist/cli.js download-model`.
   It prints `e5/Xenova/multilingual-e5-small ready in N ms`. If it fails with a download error, see the pre-seed section of `packages/notes/README.md`.
3. `docker compose logs mcp | grep "\[notes\] ready"` shows the boot time and provider.
4. In the Hub (`/mcp-control`) enable the **Notes** server for yourself, then add `https://mcp.alexiuc.dev/api/notes/mcp` as a custom connector in claude.ai (OAuth, same as the others).

## 2. Benchmarks

The mcp image ships only the production build and the host has no Node, so run the bench in a throwaway Node container
from a copy of the branch (no push needed). Before the merge use a throwaway pgvector on another port; after it, prod
`notes-db` on `127.0.0.1:5433` works too. The bench builds its own schema (`bench_<ts>`) and temp directory and drops
them at the end, so the real notes repo and index are untouched. The prod mcp container is `my-hub-mcp-1`.

```bash
# from a checkout on your machine
git archive --format=tar HEAD | ssh myhub 'rm -rf /opt/notes-bench-src && mkdir -p /opt/notes-bench-src && tar -x -C /opt/notes-bench-src'
# on the VPS: throwaway index DB (skip after the merge and use 5433 + $NOTES_DB_PASSWORD instead)
docker run -d --name notes-bench-db -p 127.0.0.1:5434:5432 -e POSTGRES_DB=notes -e POSTGRES_USER=notes -e POSTGRES_PASSWORD=benchpw pgvector/pgvector:pg18
# build once without limits (turbo needs .git, which git archive drops, so build the two packages directly)
docker run --rm -v /opt/notes-bench-src:/work -w /work node:26-bookworm-slim bash -c   'npm i -g corepack@0.36.0 && corepack enable && export CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0 &&
   pnpm install --frozen-lockfile && pnpm --filter @my-hub/shared build && pnpm --filter @my-hub/notes build'
# run with the mcp service's limits; git is required (the notes store commits every write)
docker run --rm --network host --cpus 2 --memory 2g -v /opt/notes-bench-src:/work -w /work node:26-bookworm-slim bash -c   'apt-get update -qq && apt-get install -y -qq --no-install-recommends git ca-certificates >/dev/null &&
   git config --global user.email bench@localhost && git config --global user.name bench &&
   npm i -g corepack@0.36.0 && corepack enable && export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 &&
   export NOTES_BENCH_DATABASE_URL=postgresql://notes:benchpw@127.0.0.1:5434/notes EMBEDDINGS_PROVIDER=e5 EMBEDDINGS_CACHE_DIR=/work/.model-cache &&
   pnpm --filter @my-hub/notes-bench bench -- --tier 1k,10k,50k &&
   pnpm --filter @my-hub/notes-bench bench:resolve &&
   pnpm --filter @my-hub/notes-bench bench:relevance -- --filler 5000'
# afterwards: scp the results/*.json back, then docker rm -f notes-bench-db && rm -rf /opt/notes-bench-src
```

The 2026-11-21 run of exactly this is in `docs/notes-mcp-spec.md` section 15. Inside a container `--docker-container`
cannot reach the Docker CLI; take `docker stats --no-stream` on the host instead.

`--docker-container` also samples the running mcp container's memory (the bench process hosts a second copy of the
model, so its own RSS is the model-in-process cost).

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

The result JSON files (`all-e5`, `resolve-e5`, the `--target` relevance and search runs), plus `docker stats` idle RAM of the `mcp` and `notes-db` containers.
