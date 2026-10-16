# my-hub — agent guide

Personal MCP hub. Claude.ai connects over OAuth 2.1 to MCP sub-servers (`calories`, `travel`, `finances`,
`vacation`) at `https://mcp.alexiuc.dev/api/<domain>/mcp`; a Next.js Hub (`hub.alexiuc.dev`) shows and edits the
same data; a worker runs scheduled jobs. pnpm 12 + turbo, TypeScript ESM everywhere. Keep changes small and
package-scoped.

## Packages

| Package                                         | Holds                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/shared`                               | Drizzle schema (`src/db/schema`), constants, types, **all DB queries** (`src/services/<domain>`), pure utils |
| `packages/mcp-server`                           | Fastify + MCP sub-servers. No raw Drizzle — import `@my-hub/shared/services`                                 |
| `packages/hub`                                  | Next.js App Router UI + `/api` routes, NextAuth. No raw Drizzle, no Fastify/MCP code                         |
| `packages/worker`                               | Cron jobs (`src/poll.ts`) through shared services only — no DB, no HTTP routes                               |
| `packages/e2e`                                  | Hub UI + REST Playwright specs (`tests/*.spec.ts`)                                                           |
| `packages/mcp-server/e2e`                       | MCP tool E2E via the MCP protocol (vitest, `*.e2e.ts`). MCP tool tests go here, not `packages/e2e`           |
| `infra`, `docker-bake.hcl`, `.github/workflows` | Deployment/CI only                                                                                           |

Change order for cross-layer work: shared → mcp-server → hub → worker → infra → workflows.

## Commands

- **Check what changed** (typecheck + lint + unit tests, changed packages only, quiet on success):
  `pnpm exec turbo run typecheck lint test:unit --affected --output-logs=errors-only`
- One package: `pnpm exec turbo run typecheck --filter=@my-hub/hub`. Go through turbo: it rebuilds
  `packages/shared/dist` first. A bare `pnpm --filter <pkg> typecheck` compiles against a stale/missing dist and
  reports false errors — run `pnpm --filter @my-hub/shared build` before it.
- **Before writing any helper or query**: `pnpm inventory <dir> [--docs]` lists what already exists (default: shared
  utils + services). E.g. `pnpm inventory packages/shared/src/services/finances --docs`.
- MCP surface: `pnpm --filter @my-hub/mcp-server list-tools [domain] [--desc]`.
- Schema change → `pnpm db:generate` (never hand-write schema SQL). Data-only migration →
  `pnpm --filter shared drizzle-kit generate --custom --name=<what>` and fill in the SQL.
- Throwaway Postgres: `pnpm db:scratch create | exec -- <cmd> | drop`. Running UI: `pnpm ui:sandbox` (skill).
- pnpm 12 has no `-s` flag. Use `pnpm <script>` / `pnpm exec <bin>`.

## Rules for all code

- camelCase in TypeScript (Zod schemas, API shapes, MCP inputs, forms). snake_case only for: Drizzle column-name
  strings, already-persisted JSONB fields (`FlightDetails`…), and external protocol fields (`client_id`, …).
- Reuse shared types; don't duplicate domain models. Enum-like value sets: `as const` object + union type in
  `packages/shared/src/constants/<domain>.ts` (Hub imports them from there), used in columns via `.$type<…>()`.
  Never PG enums.
- Decimals: `real()` columns. Exception: finance money/rates use `numericCasted` (`numeric(18,4|8)`).
- Patch objects: build a plain object and pass it through `omitUndefined()` (keeps `null` = "clear") or
  `omitNullish()` (null = "don't change"). No conditional spreads, no per-field `if (x != null)`.
- User mistakes / missing setup: throw a `UserInputError` subclass from the service. Hub `route()` turns it into
  a 400, MCP into a tool error — no per-route/per-tool try/catch.
- Any table with a user-ownership column needs a `deleteAllUser*` service, called from
  `packages/hub/src/app/api/user/delete-all/route.ts`. Shared-with columns: delete owned rows, null the user out
  of others'.
- Env vars: only in each package's `src/config/env.ts`, via `getEnvVar('KEY')` (required, fail fast) or
  `getEnvVar('KEY', '')` (optional) inside lazy `get` properties. Document new ones in the package
  `.env.example` (and root `.env.example` if Docker uses them). Hub: also add a placeholder `ENV` to its
  Dockerfile.
- `packages/worker` and `packages/mcp-server`: `logger` from `@my-hub/shared/utils`, never `console.*`.
- Pure helpers → `packages/shared/src/utils/`; anything touching DB/APIs/domain logic →
  `packages/shared/src/services/<domain>/`. JSDoc every exported shared function. No util functions inside
  `.tsx` component files. Hub-only UI logic stays in hub.
- MCP tools are task-oriented (`travel_plan_trip`, not `travel_create_trip`); CRUD lives in the Hub.
- New package → also update workspace config, Docker (`docker-bake.hcl`) and CI.

## Skills — load the matching one before starting

| Task                                                         | Skill                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Finishing: checks, docs, commit, push, PR                    | `verify`, then `ship`                                                    |
| New feature area end to end (tables → services → MCP → page) | `add-feature-module`                                                     |
| Design / add / change an MCP tool or resource                | `mcp-tool`                                                               |
| New MCP sub-server (`/api/<domain>/mcp`)                     | `mcp-add-server`                                                         |
| Look at the UI, screenshots, "does it render"                | `ui-sandbox`                                                             |
| Write or run Hub Playwright / MCP E2E tests locally          | `e2e-tests`                                                              |
| Red CI on a PR, E2E failures, job logs                       | `ci-triage`                                                              |
| Review a PR or diff                                          | `review-pr`                                                              |
| Theme tokens, palettes, `*-theme` classes                    | `hub-theming`                                                            |
| Worker job, cron, email report, notification subscription    | `worker-email-reports`                                                   |
| Docker, compose, Traefik, deploy, server logs                | `infra-deploy`                                                           |
| Working in finances / travel / calories / vacation code      | `finances-domain`, `travel-domain`, `calories-domain`, `vacation-domain` |

Feature specs: `docs/requirements/<hub|mcps|platform>/feature-<name>.md` — read the one for the area first.
Architecture: `PLATFORM_REQUIREMENTS.md`, `docs/` (auth: `docs/mcp-oauth-flow.md`, `docs/access-control.md`).

## Environment gotchas

- Never `pkill -f <pattern>`: the pattern matches your own shell, which dies with exit 144. Stop the sandbox with
  `pnpm ui:sandbox --stop`; otherwise kill by PID (`kill %1`, or `fuser -k 3000/tcp`).
- `turbo` failing with `Exec format error (os error 8)`, or `corepack pnpm` with `Cannot find module …/pnpm.cjs`:
  run `CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD .claude/hooks/session-start.sh`. Never `--no-verify`.
- Run `prettier --write` on the files you touched only: some docs are not prettier-clean and a directory-wide
  run adds unrelated diffs.
- Big outputs (CI logs, full diffs, `git show` of large commits) belong in a file you grep, or in a subagent
  (`ci-investigator`, `repo-reviewer`) — not in the main context.
