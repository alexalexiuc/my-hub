FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS fetcher
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm fetch

FROM fetcher AS builder
WORKDIR /app
ENV CI=true
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install -r

# Keep everything from the top through this shared build identical across the service
# Dockerfiles: docker-bake.hcl builds them together and BuildKit runs it only once.
RUN pnpm --filter @my-hub/shared build
RUN pnpm --filter @my-hub/e2e deploy --legacy /prod/e2e

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /prod/e2e/node_modules ./node_modules
COPY --from=builder /prod/e2e/package.json ./package.json
COPY packages/e2e/scripts ./scripts
COPY packages/e2e/seeds ./seeds
COPY packages/e2e/constants.ts ./
COPY packages/e2e/config.ts ./

USER node
CMD ["node_modules/.bin/tsx", "scripts/setup-e2e-db.ts"]
