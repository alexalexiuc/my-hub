# AI Working Rules

This repository is a pnpm TypeScript monorepo. Keep changes small, explicit, and package-scoped.

## Package boundaries

- `packages/shared`: Drizzle schema, shared types, auth helpers, shared DB utilities. Put cross-package domain types here first.
- `packages/mcp-server`: Fastify app, MCP transport/router wiring, health checks, server-side integrations.
- `packages/admin`: Next.js App Router UI, NextAuth integration, admin pages and client/server UI code.
- `infra`: Docker Compose, Traefik, deployment/runtime wiring only.
- `.github/workflows`: CI/CD only.

## Change order

When a feature spans multiple layers, change in this order:

1. `packages/shared`
2. `packages/mcp-server`
3. `packages/admin`
4. `infra`
5. `.github/workflows` if the build/runtime contract changed

## Project rules

- TypeScript everywhere. Follow existing ESM style.
- Reuse shared types; do not duplicate domain models across packages.
- Keep DB schema in `packages/shared/src/db/schema`.
- Keep admin-only UI logic out of `shared`.
- Keep Fastify/MCP transport code out of `admin`.
- Document every new runtime variable in the relevant `.env.example` and in the root `.env.example` if Docker uses it.
- If you add a new package, also update root workspace config, Docker, and CI.
