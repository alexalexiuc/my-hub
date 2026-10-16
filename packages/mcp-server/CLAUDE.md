# mcp-server package — Agent Guidelines

Adding or changing a tool/resource: load the `mcp-tool` skill. New `/api/<domain>/mcp` endpoint: `mcp-add-server`.
See what a domain exposes: `pnpm --filter @my-hub/mcp-server list-tools [domain] [--desc]`.

- Layout per domain: `src/<domain>/server.ts` (`create<Domain>Server()`), `tools/<area>.ts` (Zod schema + handler),
  `tools/tools.ts` (`defineTool([...])` + `register<Domain>Tools`), `resources/…` likewise, `models/` for
  MCP-side composition of shared services. A handler that is not in `tools.ts` is invisible to clients.
- Handlers are typed with the local `ToolHandler` / `ResourceHandler` (`src/shared/types.ts`), never the SDK's
  `ToolCallback`/`ReadResourceCallback` (those stay in `src/shared/toolsUtils.ts`). `context` is already
  authenticated (`userId`, `timezone`, …); `defineTool()` wraps the handler once at module load — never wrap it
  yourself.
- Stateless MCP (protocol `2026-07-28`): `create<Domain>Server()` runs per HTTP request, so keep it to
  `new McpServer(...)` + `registerTools` / `registerResources`. No I/O or schema building there.
- Errors: throw `HandledError` (`src/shared/errors.ts`) or let a service's `UserInputError` through — both reach
  the client as the tool error message and log as warnings. No per-tool try/catch.
- Logging: `logger` from `@my-hub/shared/utils`, never `console.*`.
