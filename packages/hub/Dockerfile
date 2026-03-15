FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/hub/package.json ./packages/hub/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/hub ./packages/hub

RUN pnpm --filter @my-hub/shared build
RUN pnpm --filter @my-hub/admin build

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

CMD ["node", "packages/hub/server.js"]
