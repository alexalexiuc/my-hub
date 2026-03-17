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
RUN pnpm --filter @my-hub/hub build
RUN mkdir -p /app/packages/hub/public

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/hub/.next/standalone ./
COPY --from=builder /app/packages/hub/.next/static ./packages/hub/.next/static
COPY --from=builder /app/packages/hub/public ./packages/hub/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "packages/hub/server.js"]
