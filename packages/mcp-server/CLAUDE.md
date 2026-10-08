# mcp-server package — Agent Guidelines

## Adding a new MCP tool

**Always use the `mcp-add-tool` skill** (`/mcp-add-tool`) for new tools, after designing them with `mcp-task-tools`. For a whole new domain (a new `/api/<domain>/mcp` endpoint) use `mcp-add-server` first.

If implementing manually, the two-file pattern is:

1. **Define** the Zod schema + handler in `src/<domain>/tools/<domain>.ts`:

   ```ts
   export const MyToolSchema = z.object({ ... });
   export const myTool: ToolHandler<typeof MyToolSchema.shape> = async (input, context, extra) => { ... };
   ```

2. **Register** in `src/<domain>/tools/tools.ts` — both the import and a `defineTool()` entry with a description:
   ```ts
   import { MyToolSchema, myTool } from './domain';
   // ...
   defineTool({ name: 'my_tool', description: '...', inputSchema: MyToolSchema.shape, callback: myTool });
   ```

Both steps are required. A tool defined but not registered in `tools.ts` will not be visible to clients.

## MCP handler typing

- Use local MCP-server types from `src/shared/types.ts` for implementation code:
  - `ToolHandler` for tool handlers
  - `ResourceHandler` for resource readers
- Do not import `ToolCallback` or `ReadResourceCallback` directly from the MCP SDK in feature files. Those SDK types are reserved for the transport boundary in `src/shared/toolsUtils.ts`.
- Keep handler functions in domain files (`tools/<domain>.ts`, `resources/<domain>.ts`) and keep registration files (`tools/tools.ts`, `resources/resources.ts` or `resources/index.ts`) focused on `defineTool()` / `defineResource()` entries plus registration loops.
- Handlers are wrapped once, at module load, by `defineTool()` / `defineResource()` in `src/shared/toolsUtils.ts`
  (which also prebuilds each tool's schema and caches its JSON Schema). Each domain's `registerXTools` /
  `registerXResources` just calls `registerTools(server, defs)` / `registerResources(server, defs)`. The wrapper
  resolves the authenticated `HubAuthExtra` context (`userId`, `timezone`, …) and logs failures — do not call it
  inside handlers.
- MCP is stateless (protocol `2026-07-28`): the SDK calls each domain's `createXServer()` once per HTTP request.
  Keep that factory to `new McpServer(...)` plus `registerTools`/`registerResources` — no per-request schema
  building, I/O or other setup.

## Errors

- A user-facing failure thrown from a handler should be `HandledError` (`src/shared/errors.ts`) or, from a shared
  service, `UserInputError` (`@my-hub/shared/utils`, e.g. `VacationValidationError`). Both are logged as warnings
  and reach the client as the tool error message. Anything else is logged as an unexpected error.
- Do not wrap service calls in per-domain try/catch just to translate errors; subclass `UserInputError` in the
  service instead.

## Build dependency

This package compiles against `packages/shared/dist/`. If you edit shared types or constants, build shared first:

```
cd packages/shared && npm run build
```

Otherwise TypeScript will report errors against stale type definitions.
