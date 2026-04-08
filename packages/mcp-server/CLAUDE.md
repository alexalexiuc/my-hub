# mcp-server package — Agent Guidelines

## Adding a new MCP tool

**Always use the `mcp-add-tool` skill** (`/mcp-add-tool`) for new tools. The root `AGENTS.md` also references `mcp-task-tools` for design guidance.

If implementing manually, the two-file pattern is:

1. **Define** the Zod schema + handler in `src/<domain>/tools/<domain>.ts`:

   ```ts
   export const MyToolSchema = z.object({ ... });
   export const myTool: ToolCallback<typeof MyToolSchema.shape> = async (input, extra) => { ... };
   ```

2. **Register** in `src/<domain>/tools/tools.ts` — both the import and a `defineTool()` entry with a description:
   ```ts
   import { MyToolSchema, myTool } from './domain';
   // ...
   defineTool({ name: 'my_tool', description: '...', inputSchema: MyToolSchema.shape, callback: myTool });
   ```

Both steps are required. A tool defined but not registered in `tools.ts` will not be visible to clients.

## Build dependency

This package compiles against `packages/shared/dist/`. If you edit shared types or constants, build shared first:

```
cd packages/shared && npm run build
```

Otherwise TypeScript will report errors against stale type definitions.
