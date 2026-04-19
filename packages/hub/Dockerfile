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
# lazy getters for secrets like GOOGLE_CLIENT_ID. These hard-coded placeholders
# satisfy the validation so the build succeeds; real values must only be injected
# at container runtime via docker-compose / .env files, which will override these.
ENV NEXTAUTH_SECRET=build-placeholder
ENV NEXTAUTH_URL=http://localhost:3000
ENV GOOGLE_CLIENT_ID=build-placeholder
ENV GOOGLE_CLIENT_SECRET=build-placeholder
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV ENCRYPTION_KEY=build-placeholder-32-chars-min____
ENV AWS_REGION=us-east-1
ENV UNSUBSCRIBE_SECRET=build-placeholder
ENV EMAIL_VERIFICATION_SECRET=build-placeholder
ENV SES_FROM_EMAIL=noreply@placeholder.dev
ENV HUB_URL=http://localhost:3000
ENV E2E_TEST_EMAILS=

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
