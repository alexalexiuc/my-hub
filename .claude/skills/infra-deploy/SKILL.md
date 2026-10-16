---
name: infra-deploy
description: |
  Use when touching deployment or runtime wiring — Dockerfiles, docker-bake.hcl, infra/docker-compose.*.yml,
  Traefik, GitHub Actions deploy/e2e workflows, env vars that Docker passes, staging/prod servers, server logs, DB
  backups, "why did deploy fail", "add an image/service".
metadata:
  scope: infra
  stage: implementation
---

# Infra and deploy

Server setup: `docs/server-setup.md`. Terraform: `infra/terraform/README.md`.

## Compose stacks (`infra/`)

| File                         | What                                                                                                       | Run as                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `docker-compose.traefik.yml` | Shared Traefik + external `proxy` network; started once, never stopped between deploys                     | `docker compose --project-name my-hub-traefik -f infra/docker-compose.traefik.yml up -d`                                 |
| `docker-compose.prod.yml`    | Prod: GHCR images (`ghcr.io/<owner>/…`), `migrate` service on start, `mcp.alexiuc.dev` / `hub.alexiuc.dev` | `pnpm start:prod` — **must** keep `--project-name my-hub` (owns the `my-hub_db_data` volume)                             |
| `docker-compose.staging.yml` | Staging: builds from source, `staging.*.alexiuc.dev`, own `db_staging_data` volume                         | `docker compose --project-name my-hub-staging --env-file .env.staging -f infra/docker-compose.staging.yml up -d --build` |
| `docker-compose.local.yml`   | Standalone local stack, no Traefik, ports 3000/3001, DB on the host (`host.docker.internal`)               | `pnpm start:local`                                                                                                       |

Prod and staging share the VPS and the `proxy` network; E2E CI deploys the staging stack per PR (one at a time).

## Images

- `docker-bake.hcl` is how CI builds every image (`prod` group in `deploy.yml`, `staging` group in `e2e.yml`).
  New image = new bake target. Local single image: `docker buildx bake --load hub`.
- Keep the service Dockerfiles (`hub`, `mcp-server`, `worker`, `e2e`) **byte-identical from `FROM` through
  `RUN pnpm --filter @my-hub/shared build`** so BuildKit runs install + shared build once for all images.
  Image-specific steps (hub's placeholder `ENV` block) go after it.
- Hub build-time placeholders: every required hub env var needs an `ENV` placeholder before the hub build step;
  real values come from compose env files at runtime. Reproduce the Docker build's env locally with
  `pnpm ui:sandbox --prod --skip-seed` (same placeholder approach).

## Env vars

New runtime variable → package `src/config/env.ts` getter, the package `.env.example`, the root `.env.example` if
compose passes it, and the compose files / workflow `env:` blocks that need it.

## Operating

- Logs: `pnpm logs:server` / `logs:server:prod` / `logs:server:staging` (`infra/scripts/server-compose-logs.mjs`).
- Worker jobs handle DB backups, log cleanup and Docker log archiving to S3 (`packages/worker/src/db-backup.ts`,
  `docker-log-backup.ts`, `db-log-cleanup.ts`).
- Migrations run via the prod `migrate` service on deploy: a destructive generated migration ships with the next
  merge to `main` — call it out in the PR.
