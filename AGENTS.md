# AI Working Rules

This repository is a pnpm TypeScript monorepo. Keep changes small, explicit, and package-scoped.

## Package boundaries

- `packages/shared`: Drizzle schema, shared types, auth helpers, service layer (`src/services/`), and utilities (`src/utils/`). Put cross-package domain types and DB queries here first.
- `packages/mcp-server`: Fastify app, MCP transport/router wiring, health checks, server-side integrations. Must not contain raw Drizzle queries — import from `@my-hub/shared/services` instead.
- `packages/hub`: Next.js App Router UI, NextAuth integration, Hub Dashboard pages and client/server UI code.
- `infra`: Docker Compose, Traefik, deployment/runtime wiring only.
- `.github/workflows`: CI/CD only.

## Change order

When a feature spans multiple layers, change in this order:

1. `packages/shared`
2. `packages/mcp-server`
3. `packages/hub`
4. `infra`
5. `.github/workflows` if the build/runtime contract changed

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
