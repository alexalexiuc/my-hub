# Debian (glibc), not Alpine: the notes server's embedding model runs on onnxruntime-node, which ships
# glibc-only native binaries. Keep builder and runner on the same libc so installed native deps match.
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Node 25+ no longer bundles Corepack; install it to keep pnpm pinned by package.json "packageManager".
RUN npm install -g corepack@0.36.0 && corepack enable

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

# Unlike the other service Dockerfiles (Alpine), this one is Debian, so BuildKit cannot reuse their
# install/build prefix: this image runs its own fetch, install and shared build.
RUN pnpm --filter @my-hub/shared build
RUN pnpm --filter @my-hub/notes build
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

# ca-certificates: the embedding model download needs it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Owned by `node` so fresh named volumes mounted here are writable (notes, embedding model cache).
RUN mkdir -p /app/data/travel-documents /app/data/notes /app/data/model-cache \
  && chown node:node /app/data/travel-documents /app/data/notes /app/data/model-cache

EXPOSE 3001
USER node
CMD ["node", "dist/main.js"]
