FROM node:22-alpine AS base
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
  pnpm install -r --offline

RUN pnpm --filter @my-hub/shared build
RUN pnpm --filter @my-hub/e2e build:seed

RUN pnpm --filter @my-hub/e2e deploy --prod --legacy /prod/e2e

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /prod/e2e/dist ./dist
COPY --from=builder /prod/e2e/node_modules ./node_modules
COPY --from=builder /prod/e2e/package.json ./package.json

USER node
CMD ["node", "dist/setup-e2e-db.mjs"]
