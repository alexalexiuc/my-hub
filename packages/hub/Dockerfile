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

# Build-time placeholder values for required env vars.
# Next.js static analysis loads route modules during `next build`, which triggers
# lazy getters for secrets like GOOGLE_CLIENT_ID. These placeholders satisfy the
# validation so the build succeeds; real values are injected at container runtime
# via docker-compose / .env files and will override these.
ARG NEXTAUTH_SECRET=build-placeholder
ARG NEXTAUTH_URL=http://localhost:3000
ARG GOOGLE_CLIENT_ID=build-placeholder
ARG GOOGLE_CLIENT_SECRET=build-placeholder
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ARG ENCRYPTION_KEY=build-placeholder-32-chars-min____
ARG AWS_REGION=us-east-1
ARG UNSUBSCRIBE_SECRET=build-placeholder
ARG SES_FROM_EMAIL=noreply@placeholder.dev
ARG HUB_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
ENV DATABASE_URL=$DATABASE_URL
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV AWS_REGION=$AWS_REGION
ENV UNSUBSCRIBE_SECRET=$UNSUBSCRIBE_SECRET
ENV SES_FROM_EMAIL=$SES_FROM_EMAIL
ENV HUB_URL=$HUB_URL

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
COPY --from=builder /app/packages/hub/scripts ./packages/hub/scripts

RUN mkdir -p /app/data/travel-documents && chown nextjs:nodejs /app/data/travel-documents

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "packages/hub/server.js"]
