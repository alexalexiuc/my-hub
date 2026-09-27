---
name: mcp-add-server
description: |
  Use when adding a new MCP sub-server / domain endpoint (`/api/<domain>/mcp`), e.g. "add a new MCP server",
  "create a <domain> MCP", "expose <feature> to Claude as its own connector". Lists every place the server
  name must be wired. Tools themselves are added afterwards with mcp-task-tools + mcp-add-tool.
metadata:
  scope: mcp-server
  stage: implementation
---

# Adding a new MCP sub-server

A server name appears in nine places. Miss one and the server is either unreachable, invisible in the Hub, or its
data survives "Delete all my data". Do them in this order (root `CLAUDE.md` change order).

## shared

1. **Server name** — add `<Domain>: '<domain>'` to `McpServerNames` in `packages/shared/src/constants/mcp-servers.ts`.
   `ensureAllMcpServers` then creates the per-user enabled row automatically; no migration is needed for this.
2. **Delete-all service** — every user-owned table needs a `deleteAllUser<Domain>*` function in
   `packages/shared/src/services/<domain>/` (see the root `CLAUDE.md` ownership rule). Rebuild shared.

## mcp-server

3. **Server factory** — `src/<domain>/server.ts` exporting `create<Domain>Server()` that builds an `McpServer`
   and calls `register<Domain>Tools(server)` (copy `src/vacation/server.ts`).
4. **Tools module** — `src/<domain>/tools/tools.ts` with the `defineTool([...])` array and the
   `register<Domain>Tools` loop using `wrapToolHandler`, plus `tools/index.ts` re-exporting it.
5. **Registration** — in `src/server.ts`, import the factory and add
   `registerMcpSubServer(app, '/api/<domain>/mcp', McpServerNames.<Domain>, create<Domain>Server);`
   and extend the endpoint list in the comment above it.

## hub

6. **MCP control page** — `src/app/mcp-control/constants.ts`: a `SERVER_META` entry (label, path, description,
   `active: true`) and a `SERVER_OPTIONS` entry. `SERVER_META` is a `Record<McpServerName, …>`, so typecheck fails
   until it is added.
7. **Data deletion** — call the delete function from step 2 in both
   `src/app/api/user/delete-all/route.ts` (always) and `src/app/api/user/delete-data/route.ts` (new
   `SUPPORTED_FEATURES` key + `case`), and add the matching option to `src/app/profile/DataDeletionSection.tsx`.

## docs

8. `PLATFORM_REQUIREMENTS.md` — the sub-server list, the key-tables table and the endpoint examples.
9. `docs/requirements/hub/feature-mcp-control.md` (server examples) and a new
   `docs/requirements/mcps/feature-<domain>.md` spec.

## Verify

- `pnpm typecheck` (all packages) and the `verify` skill for the touched packages.
- Add `packages/mcp-server/e2e/<domain>.e2e.ts` (copy `vacation.e2e.ts`: tag data with a run id, clean up in
  `afterAll`). To run it locally without touching your dev credentials, see the `ui-sandbox` skill's
  "Throwaway database" section.
- Users add the connector in claude.ai with the URL `https://mcp.alexiuc.dev/api/<domain>/mcp`.
