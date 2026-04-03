# AI Working Rules

This repository is a pnpm TypeScript monorepo. Keep changes small, explicit, and package-scoped.

## Package boundaries

- `packages/shared`: Drizzle schema, shared types, auth helpers, service layer (`src/services/`), and utilities (`src/utils/`). Put cross-package domain types and DB queries here first.
- `packages/mcp-server`: Fastify app, MCP transport/router wiring, health checks, server-side integrations. Must not contain raw Drizzle queries — import from `@my-hub/shared/services` instead.
- `packages/hub`: Next.js App Router UI, NextAuth integration, Hub Dashboard pages and client/server UI code.
- `packages/worker`: Standalone Node.js background service. Runs scheduled polling jobs (e.g. flight data sync). Imports from `@my-hub/shared/services` only — no direct DB access, no HTTP routes.
- `packages/e2e`: Playwright end-to-end tests for the hub UI. Tests run against a live hub instance (`E2E_HUB_BASE_URL`). Global setup auto-registers the test user (`e2e-hub@test.local`) and persists auth state in `.auth/user.json`. Run with `pnpm --filter @my-hub/e2e test:e2e`.
- `infra`: Docker Compose, Traefik, deployment/runtime wiring only.
  - `docker-compose.traefik.yml` — **run once on the server**; starts the shared Traefik reverse proxy and creates the named `proxy` Docker network. Both prod and staging connect to this external network. Never stopped between deploys. Usage: `docker compose --project-name my-hub-traefik -f infra/docker-compose.traefik.yml up -d`.
  - `docker-compose.local.yml` — **standalone** local dev stack; no Traefik, services exposed directly on host ports (`3000`, `3001`), DB runs on the host machine (connected via `host.docker.internal`). Usage: `docker compose --project-name my-hub-local -f infra/docker-compose.local.yml up`.
  - `docker-compose.prod.yml` — **standalone** production deployment; pulls pre-built images from GHCR (`ghcr.io/<owner>/...`), runs the `migrate` service on startup, uses production domains (`mcp.alexiuc.dev`, `hub.alexiuc.dev`). Connects to the external `proxy` network. **Must use `--project-name my-hub`** (preserves existing `my-hub_db_data` volume). Usage: `docker compose --project-name my-hub --env-file .env -f infra/docker-compose.prod.yml up -d`.
  - `docker-compose.staging.yml` — **standalone** staging deployment; builds images from source, uses staging domains (`staging.mcp.alexiuc.dev`, `staging.hub.alexiuc.dev`) and a separate DB volume (`db_staging_data`). Connects to the same external `proxy` network. Usage: `docker compose --project-name my-hub-staging --env-file .env.staging -f infra/docker-compose.staging.yml up -d --build`.
- `.github/workflows`: CI/CD only.

## Change order

When a feature spans multiple layers, change in this order:

1. `packages/shared`
2. `packages/mcp-server`
3. `packages/hub`
4. `packages/worker`
5. `infra`
6. `.github/workflows` if the build/runtime contract changed

## Documentation

- `docs/` contains architectural and operational guides. Read relevant files there before working on auth, deployment, or MCP flows.
  - `docs/server-setup.md` — VM provisioning, firewall, deploy user, Docker setup
  - `docs/mcp-oauth-flow.md` — end-to-end OAuth 2.1 + PKCE flow between Claude.ai and the MCP server
  - `docs/requirements/` — feature specs (FR/TR style); one file per feature area, organised by `hub/`, `mcps/`, `platform/`
- When documenting a new feature or flow, add it to `docs/` following the existing style. Requirements go in `docs/requirements/<area>/feature-<name>.md`; architectural/flow guides go directly in `docs/`.

## Agent operating rules for docs

- **Before working on a feature**, read the corresponding `docs/requirements/<area>/feature-<name>.md` file. It defines the functional and technical requirements, constraints, and acceptance criteria for that area.
- **After implementing or modifying a feature**, update the requirement doc:
  - Set the `Status` field to `in-progress` or `implemented` as appropriate.
  - Check off (`[x]`) acceptance criteria that are now satisfied.
  - Add a new requirement entry if the implementation introduces a behaviour not previously documented.
- **When architectural facts change** (package names, services, routing, deployment strategy), update `PLATFORM_REQUIREMENTS.md` to reflect the current state. It must describe how the system works today, not how it was planned.

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

## Email & notification services

- `packages/shared/src/services/notifications/` — notification subscription service. `NOTIFICATION_SUBSCRIPTIONS` in `config.ts` is the single source of truth for subscription keys, UI labels, and section groupings. Always add new subscription types here first. Never use PG enums for subscription keys — store them as plain `text`.
- `packages/shared/src/services/email/` — AWS SES email service. Generic send function in `send-email.ts`; HTML templates under `templates/<report-name>/`. Always run the HTML string through `juice` before sending (CSS inlining for email client compatibility). Use `SES_FROM_EMAIL` env var as the sender address.
- New email report types follow the pattern: add a `{ key, label, section }` entry to `NOTIFICATION_SUBSCRIPTIONS`, add a template directory under `templates/`, add a worker job in `packages/worker/src/`, and register the cron in `poll.ts`.

## MCP tool design rules

- Design MCP tools around user intents and natural-language tasks, not raw CRUD operations.
- Prefer outcome-oriented tool names (for example, `travel_plan_trip`) over table-oriented names (for example, `travel_create_trip`).
- Keep full, granular CRUD capabilities in Hub UI and internal APIs when possible; avoid exposing redundant MCP CRUD tools unless required for composition.
- Use MCP resources for read-only context snapshots and MCP tools for action workflows.
- For new MCP tool design work, start from `.claude/skills/mcp-task-tools/SKILL.md`, then implement with `.claude/skills/mcp-add-tool/SKILL.md`.
