# mcp-server package — Agent Guidelines

## Adding a new MCP tool

**Always use the `mcp-add-tool` skill** (`/mcp-add-tool`) for new tools. The root `AGENTS.md` also references `mcp-task-tools` for design guidance.

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
- Register handlers through the shared wrappers from `src/shared/toolsUtils.ts`:
  - `withUserIdCheck(...)` for tools
  - `withUserIdCheckResource(...)` for resources
  - No auth-skipping resource wrapper exists today; if you need one, add it in `src/shared/toolsUtils.ts` before documenting or using it

## Build dependency

This package compiles against `packages/shared/dist/`. If you edit shared types or constants, build shared first:

```
cd packages/shared && npm run build
```

Otherwise TypeScript will report errors against stale type definitions.
