# Project Guidelines

This repository is a pnpm TypeScript monorepo. Keep changes small, explicit, and package-scoped.

## Package boundaries

- `packages/shared`: Drizzle schema, shared types, auth helpers, service layer (`src/services/`), and utilities (`src/utils/`). Put cross-package domain types and DB queries here first.
- `packages/mcp-server`: Fastify app, MCP transport/router wiring, health checks, server-side integrations. Must not contain raw Drizzle queries — import from `@my-hub/shared/services` instead.
- `packages/hub`: Next.js App Router UI, NextAuth integration, Hub Dashboard pages and client/server UI code.
- `packages/worker`: Standalone Node.js background service. Runs scheduled polling jobs (e.g. flight data sync). Imports from `@my-hub/shared/services` only — no direct DB access, no HTTP routes.
- `packages/e2e`: Playwright end-to-end tests for the **Hub UI and Hub REST API**. Tests are in `tests/*.spec.ts`. Tests run against a live hub instance (`E2E_HUB_BASE_URL`). Global setup auto-registers the test user (`e2e-hub@test.local`) and persists auth state in `.auth/user.json`. Hub E2E seed sources must stay in `packages/e2e/seeds/`, orchestrated by `packages/e2e/scripts/setup-e2e-db.ts`. Local Playwright runs seed by spawning that script only when `IS_LOCAL=true`; CI seeds by running the compiled script inside the `hub` container over SSH. Do not move Hub E2E fixtures into MCP setup scripts or DB migrations. Run with `pnpm --filter @my-hub/e2e test:e2e`.
- `packages/mcp-server/e2e`: Vitest end-to-end tests that exercise **MCP tools via the MCP protocol**. Tests are in `*.e2e.ts` files, use `createMcpClient`/`callTool` helpers (not Playwright), and run against a live MCP server instance. Local runs do **not** auto-provision test OAuth credentials; run `pnpm --filter @my-hub/mcp-server e2e:setup` first so `e2e/.env.e2e` is written, then run `pnpm --filter @my-hub/mcp-server test:e2e`. CI provisions MCP E2E credentials by executing `packages/mcp-server/e2e/scripts/setup-e2e-db.ts` inside the `mcp` container over SSH. **MCP tool tests belong here — not in `packages/e2e`.**
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
- Keep cross-package/domain constants (enum-like value sets) in `packages/shared/src/constants/<domain>.ts` so Hub client code can import them safely.
- DB schema files may import and re-export those constants/types, but should not be the primary source of UI-facing constants.
- For any DB field that is conceptually a union/enum, define an enum-like `as const` object + union type in `packages/shared/src/constants/<domain>.ts`, then use that type in schema columns via Drizzle `. $type<...>()`.
- Keep DB schema in `packages/shared/src/db/schema`.
- For schema changes, run `pnpm db:generate` to create migrations instead of hand-writing migration files.
- For data-only changes (seeds, backfills, one-off SQL, extensions), generate an empty custom migration via `pnpm --filter shared drizzle-kit generate --custom --name=<description>` and fill in the SQL manually. Never hand-write schema migrations.
- All DB queries belong in `packages/shared/src/services/` under a domain subfolder. Never write raw Drizzle calls in `mcp-server` or `hub`.
- Any table with a user-linked ownership column (for example `user_id`, `owner_user_id`, or `shared_with_user_id`) must expose a `deleteAllUser*` function from `packages/shared/src/services/`, and `packages/hub/src/app/api/user/delete-all/route.ts` (`POST`) must call it so the Profile "Delete all my data" action clears all user data. For cases with complex ownership rules (for example, `shared_with_user_id` can contain multiple users), the `deleteAllUser*` function should delete only rows where the user is the owner (`user_id`), and null out the user from shared ownership columns (`shared_with_user_id`) in rows they don't own.
- Use `real()` columns (not `numeric`) for all decimal/float values — avoids string↔number conversions at the JS boundary.
- Use `omitNullish()` from `@my-hub/shared/utils` instead of writing `if (val != null)` guards per property.
- Keep hub-only UI logic out of `shared`.
- Keep Fastify/MCP transport code out of `hub`.
- Document every new runtime variable in the relevant `.env.example` and in the root `.env.example` if Docker uses it.

## Logging rules

Never use `console.log`, `console.error`, or `console.warn` directly in `packages/worker` or `packages/mcp-server`. Use `logger` from `@my-hub/shared/utils` instead — it prefixes every line with an ISO 8601 timestamp, which is essential for reading logs from Docker or S3 archives.

```ts
import { logger } from '@my-hub/shared/utils';

logger.info('[worker] Task started');
logger.warn('[worker] Unexpected state, continuing');
logger.error('[worker] Task failed:', err);
```

`console.log` remains acceptable in: E2E/test scripts, CLI help output in `scripts/`, and Next.js client components where no server logger is available.

## Environment variable rules

Every package centralises its env vars in a single `src/config/env.ts` file that exports a typed config object. Use `getEnvVar` from `@my-hub/shared/utils` — never read `process.env` directly outside of that file.

```ts
import { getEnvVar } from '@my-hub/shared/utils';

export const myEnvConfig = {
  get MY_SECRET() {
    return getEnvVar('MY_SECRET');
  }, // required — throws if missing
  get MY_OPTIONAL() {
    return getEnvVar('MY_OPTIONAL', '');
  }, // optional — falls back to ''
};
```

**Lazy getters are mandatory for hub.** Next.js loads route modules during `next build` for static analysis. If env vars are read eagerly (plain object properties or `const x = process.env.X`), the build fails in Docker where secrets are not present. Lazy `get` properties defer the read to first access, which always happens at request time.

**Lazy getters are still preferred for mcp-server and worker** for consistency, even though their `tsc`-only builds never execute code.

**Default vs required:**

- Use `getEnvVar('KEY')` (no default) for secrets and values that have no safe fallback. The process crashes on startup if missing — this is the desired fail-fast behaviour.
- Use `getEnvVar('KEY', '')` for optional integrations (e.g. `RAPIDAPI_KEY` — empty string disables the feature).
- Never default required secrets to empty string; silent empty-string usage in prod is harder to diagnose than a startup crash.

**Docker build-time placeholders (hub only):** `packages/hub/Dockerfile` declares `ARG`/`ENV` blocks with placeholder values before `RUN pnpm ... hub build`. This lets `next build` succeed without real secrets. Real values are injected at container runtime via `docker-compose` env files and override the placeholders. When adding a new required env var to hub, add a matching `ARG`/`ENV` placeholder line to `packages/hub/Dockerfile`.

- If you add a new package, also update root workspace config, Docker, and CI.
- For Hub Playwright E2E setup, do not import local seed TS modules directly from `global.setup.ts`. Playwright setup runs through a CommonJS loader and will fail on the ESM seed graph. Invoke `packages/e2e/scripts/setup-e2e-db.ts` as a child process for local seeding instead.

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

## Shared function and utility design rules

- For new shared functions, add them to `packages/shared/src/utils/` if they are pure utilities with no side effects or external dependencies. For example, a date formatting function or a string manipulation helper.
- For functions that interact with external systems (databases, APIs, file system), or that encapsulate domain logic, add them to `packages/shared/src/services/` under the appropriate domain subfolder. For example, a function that queries the database for user data or calls an external API to fetch information.
- Always write clear JSDoc comments for shared functions, describing their purpose, parameters, return values, and any side effects. This helps other developers understand how to use them correctly.
- Avoid defining util functions in the same file as tsx component. If a function is used by multiple components or has complex logic, it should be moved to a separate file in `utils/` and imported where needed. This promotes code reuse and keeps component files focused on UI logic.
- When adding a new utility function, consider if it can be made more generic and reusable across different parts of the codebase. For example, a function that formats dates could be designed to accept various formats and locales, making it useful in multiple contexts.
