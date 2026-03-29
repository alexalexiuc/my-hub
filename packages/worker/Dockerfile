FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Fetch all deps from lockfile (cached layer) ──────────────────────────────
FROM base AS fetcher
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm fetch

# ── Install & build ───────────────────────────────────────────────────────────
FROM fetcher AS builder
WORKDIR /app
ENV CI=true
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install -r --offline --filter @my-hub/worker...
WORKDIR /app/packages/worker
RUN pnpm build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Copy the built worker
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder /app/packages/worker/package.json ./packages/worker/package.json

# Copy shared package (needed for drizzle migrations + runtime imports)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/drizzle ./packages/shared/drizzle
COPY --from=builder /app/packages/shared/drizzle.config.ts ./packages/shared/drizzle.config.ts

# Copy only necessary node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/worker/node_modules ./packages/worker/node_modules 2>/dev/null || true
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true

# Workspace manifests needed by pnpm
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json ./package.json

# Entrypoint: run migrations then start the worker
COPY packages/worker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
