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
RUN pnpm --filter @my-hub/worker build

RUN pnpm --filter @my-hub/worker deploy --prod --legacy /prod/worker

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /prod/worker/dist ./dist
COPY --from=builder /prod/worker/node_modules ./node_modules
COPY --from=builder /prod/worker/package.json ./package.json

USER node
CMD ["node", "dist/index.js"]
