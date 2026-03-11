FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/mcp-server/package.json ./packages/mcp-server/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/mcp-server ./packages/mcp-server

RUN pnpm --filter @my-hub/shared build
RUN pnpm --filter @my-hub/mcp-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist
COPY --from=builder /app/packages/mcp-server/package.json ./packages/mcp-server/package.json

EXPOSE 3001
CMD ["node", "packages/mcp-server/dist/index.js"]
