# AI Working Rules

This repository is a pnpm TypeScript monorepo. Keep changes small, explicit, and package-scoped.

## Package boundaries

- `packages/shared`: Drizzle schema, shared types, auth helpers, service layer (`src/services/`), and utilities (`src/utils/`). Put cross-package domain types and DB queries here first.
- `packages/mcp-server`: Fastify app, MCP transport/router wiring, health checks, server-side integrations. Must not contain raw Drizzle queries — import from `@my-hub/shared/services` instead.
- `packages/hub`: Next.js App Router UI, NextAuth integration, Hub Dashboard pages and client/server UI code.
- `packages/e2e`: Playwright end-to-end tests for the hub UI. Tests run against a live hub instance (`E2E_HUB_BASE_URL`). Global setup auto-registers the test user (`e2e-hub@test.local`) and persists auth state in `.auth/user.json`. Run with `pnpm --filter @my-hub/e2e test:e2e`.
- `infra`: Docker Compose, Traefik, deployment/runtime wiring only.
  - `docker-compose.traefik.yml` — **run once on the server**; starts the shared Traefik reverse proxy and creates the named `proxy` Docker network. Both prod and staging connect to this external network. Never stopped between deploys.
  - `docker-compose.local.yml` — **standalone** local dev stack; no Traefik, services exposed directly on host ports (`3000`, `3001`), DB runs on the host machine (connected via `host.docker.internal`). Usage: `docker compose -f infra/docker-compose.local.yml up`.
  - `docker-compose.prod.yml` — **standalone** production deployment; pulls pre-built images from GHCR (`ghcr.io/<owner>/...`), runs the `migrate` service on startup, uses production domains (`mcp.alexiuc.dev`, `hub.alexiuc.dev`). Connects to the external `proxy` network. Usage: `docker compose --env-file .env -f infra/docker-compose.prod.yml up -d`.
  - `docker-compose.staging.yml` — **standalone** staging deployment; builds images from source, uses staging domains (`staging.mcp.alexiuc.dev`, `staging.hub.alexiuc.dev`) and a separate DB volume (`db_staging_data`). Connects to the same external `proxy` network. Run with project name `my-hub-staging` to keep containers isolated from prod. Usage: `docker compose --project-name my-hub-staging --env-file .env.staging -f infra/docker-compose.staging.yml up -d --build`.
- `.github/workflows`: CI/CD only.

## Change order

When a feature spans multiple layers, change in this order:

1. `packages/shared`
2. `packages/mcp-server`
3. `packages/hub`
4. `infra`
5. `.github/workflows` if the build/runtime contract changed

## Documentation

- `docs/` contains architectural and operational guides. Read relevant files there before working on auth, deployment, or MCP flows.
  - `docs/server-setup.md` — VM provisioning, firewall, deploy user, Docker setup
  - `docs/mcp-oauth-flow.md` — end-to-end OAuth 2.1 + PKCE flow between Claude.ai and the MCP server
  - `docs/requirements/` — feature specs (FR/TR style); one file per feature area, organised by `hub/`, `mcps/`, `platform/`
- When documenting a new feature or flow, add it to `docs/` following the existing style. Requirements go in `docs/requirements/<area>/feature-<name>.md`; architectural/flow guides go directly in `docs/`.

## Project rules

- TypeScript everywhere. Follow existing ESM style.
- Reuse shared types; do not duplicate domain models across packages.
- Keep DB schema in `packages/shared/src/db/schema`.
- For schema changes, run `pnpm db:generate` to create migrations instead of hand-writing migration files.
- For data-only changes (seeds, backfills, one-off SQL, extensions), generate an empty custom migration via `pnpm --filter shared drizzle-kit generate --custom --name=<description>` and fill in the SQL manually. Never hand-write schema migrations.
- All DB queries belong in `packages/shared/src/services/` under a domain subfolder. Never write raw Drizzle calls in `mcp-server` or `hub`.
- Use `real()` columns (not `numeric`) for all decimal/float values — avoids string↔number conversions at the JS boundary.
- Use `omitNullish()` from `@my-hub/shared/utils` instead of writing `if (val != null)` guards per property.
- Keep hub-only UI logic out of `shared`.
- Keep Fastify/MCP transport code out of `hub`.
- Document every new runtime variable in the relevant `.env.example` and in the root `.env.example` if Docker uses it.
- If you add a new package, also update root workspace config, Docker, and CI.
