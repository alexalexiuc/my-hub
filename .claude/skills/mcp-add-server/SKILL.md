---
name: mcp-add-server
description: |
  Use when adding a new MCP sub-server / domain endpoint (`/api/<domain>/mcp`), e.g. "add a new MCP server",
  "create a <domain> MCP", "expose <feature> to Claude as its own connector". Lists every place the server name
  must be wired. Tools themselves are then added with the mcp-tool skill.
metadata:
  scope: mcp-server
  stage: implementation
---

# Adding a new MCP sub-server

A server name is wired in ten places. Miss one and the server is unreachable, invisible in the Hub, or its data
survives "Delete all my data". Copy the vacation server (`git log --oneline -- packages/mcp-server/src/vacation`).

## shared

1. `McpServerNames` in `packages/shared/src/constants/mcp-servers.ts`: add `<Domain>: '<domain>'`.
   `ensureAllMcpServers` creates the per-user enabled row — no migration needed.
2. `deleteAllUser<Domain>*` in `packages/shared/src/services/<domain>/` for every user-owned table.

## mcp-server

3. `src/<domain>/server.ts` — `create<Domain>Server()`: `new McpServer({...})` + `register<Domain>Tools(server)`
   and nothing else (it runs per request).
4. `src/<domain>/tools/tools.ts` — `const <domain>Tools = [defineTool({...}), …]` and
   `export function register<Domain>Tools(server) { registerTools(server, <domain>Tools); }`; `tools/index.ts`
   re-exports it. Resources the same way with `defineResource` / `registerResources`.
5. `src/server.ts` — `registerMcpSubServer(app, '/api/<domain>/mcp', McpServerNames.<Domain>, create<Domain>Server);`
   and extend the endpoint list in the comment above it.
6. `scripts/list-tools.ts` — add the domain's register functions to `DOMAINS`.

## hub

7. `src/app/mcp-control/constants.ts` — `SERVER_META` entry (label, path, description, `active: true`) and a
   `SERVER_OPTIONS` entry. `SERVER_META` is a `Record<McpServerName, …>`, so typecheck fails until it exists.
8. Data deletion: call step 2's function in `src/app/api/user/delete-all/route.ts` (always) and
   `src/app/api/user/delete-data/route.ts` (new `SUPPORTED_FEATURES` key + `case`), and add the option to
   `src/app/profile/DataDeletionSection.tsx`.

## docs

9. `PLATFORM_REQUIREMENTS.md` — sub-server list, key-tables table, endpoint examples.
10. `docs/requirements/hub/feature-mcp-control.md` (server examples) + new `docs/requirements/mcps/feature-<domain>.md`
    (from `docs/requirements/_template.md`).

## Verify

- `pnpm --filter @my-hub/mcp-server list-tools <domain>` lists the tools.
- `pnpm exec turbo run typecheck lint test:unit --affected --output-logs=errors-only`.
- `packages/mcp-server/e2e/<domain>.e2e.ts` (copy `vacation.e2e.ts`), run locally via the `e2e-tests` skill.
- Users connect it in claude.ai with `https://mcp.alexiuc.dev/api/<domain>/mcp`.
