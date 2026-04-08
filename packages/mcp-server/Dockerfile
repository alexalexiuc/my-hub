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
RUN pnpm --filter @my-hub/mcp-server build

RUN pnpm --filter @my-hub/mcp-server deploy --prod --legacy /prod/mcp-server

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV MCP_HOST=0.0.0.0

COPY --from=builder /prod/mcp-server/dist ./dist
COPY --from=builder /prod/mcp-server/node_modules ./node_modules
COPY --from=builder /prod/mcp-server/package.json ./package.json
COPY --from=builder /app/packages/mcp-server/scripts ./scripts



EXPOSE 3001
USER node
CMD ["node", "dist/main.js"]
