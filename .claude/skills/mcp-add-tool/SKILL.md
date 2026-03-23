---
name: mcp-add-tool
description: |
  This skill should be used when the user asks to "add a tool", "create a tool",
  "add a new MCP tool", "create a new MCP tool", "implement a tool", or asks to
  add a new capability to the MCP server as a tool (as opposed to a resource).
  Applies to MCP servers in this repository.
metadata:
  scope: mcp-server
  stage: implementation
---

# Adding a New MCP Tool

Before using this skill, first design tools with `.claude/skills/mcp-task-tools/SKILL.md`.
This implementation skill should be used after task-oriented tool semantics are approved.

Adding a tool requires changes to two places: a new implementation file and a registration
entry in `tools/tools.ts`. Follow the steps below exactly.

## Step 1 — Create the implementation file

Create `packages/mcp-server/src/calories/tools/<name>.ts`.

**Required imports:**

```typescript
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { toolResponse } from '../../shared/toolsUtils';
// Add any shared service imports from '@my-hub/shared/services' as needed
```

**Define a Zod schema** for the tool's input:

```typescript
export const MyActionSchema = z.object({
  param1: z.string().describe('Description of param1 for the AI model.'),
  param2: z.number().int().optional().describe('Optional numeric param.'),
});
```

**Implement the callback** typed against the schema shape:

```typescript
export const myActionTool: ToolCallback<typeof MyActionSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  // ... business logic, call shared services, etc.

  return toolResponse({
    /* structured output */
  });
};
```

Key rules:

- Always extract and check `userId` unless the tool is truly public (like `getMeasurementTypes`).
- Return via `toolResponse(payload)` — this wraps the payload in the MCP text content format.
- Throw plain `Error` instances for user-visible errors (the SDK surfaces them cleanly).
- For read-only tools add no side-effect annotations; for writes set `idempotentHint: false`.

**Minimal real example** (`summary.ts`):

```typescript
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { buildDailySummary } from '../models/daily';

export const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

export const getDailySummaryTool: ToolCallback<typeof GetDailySummarySchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const date = input.date ?? new Date().toISOString().split('T')[0]!;
  const summary = await buildDailySummary(userId, date);
  return toolResponse(summary);
};
```

## Step 2 — Register in `tools/tools.ts`

File: `packages/mcp-server/src/calories/tools/tools.ts`

1. **Add imports** at the top (alongside the other tool imports):

```typescript
import { MyActionSchema, myActionTool } from './my-action';
```

2. **Add a `defineTool` entry** to the `caloriesTools` array:

```typescript
defineTool({
  name: 'calories_my_action',          // prefix all tool names with 'calories_'
  description:
    'One paragraph description for the AI model. Be specific about when to use ' +
    'this tool vs alternatives. Mention related resources or tools if relevant.',
  inputSchema: MyActionSchema.shape,
  annotations: { readOnlyHint: true },  // or { idempotentHint: false, destructiveHint: false/true }
  callback: myActionTool,
  // skipUserIdCheck: true,             // only for truly public tools (no user data)
}),
```

**Annotation reference:**

| Scenario                    | Annotations                                         |
| --------------------------- | --------------------------------------------------- |
| Read-only query             | `{ readOnlyHint: true }`                            |
| Write, non-destructive      | `{ idempotentHint: false, destructiveHint: false }` |
| Write, destructive (delete) | `{ idempotentHint: false, destructiveHint: true }`  |

## Step 3 — Export from `tools/index.ts` (only if needed)

File: `packages/mcp-server/src/calories/tools/index.ts`

Currently this file just re-exports `./tools`. Only add an explicit export if symbols from the
new file are consumed outside the `tools/` folder:

```typescript
export * from './my-action'; // add only if needed externally
```

Most tools do NOT need this — `tools.ts` imports directly from the implementation file.

## Shared utilities reference

| Utility                      | Location                  | Purpose                                                          |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `toolResponse(payload)`      | `../../shared/toolsUtils` | Wrap any object as MCP tool response                             |
| `defineTool(def)`            | `../../shared/toolsUtils` | Type-safe tool definition (used in tools.ts)                     |
| `withUserIdCheck(cb, skip?)` | `../../shared/toolsUtils` | Auth middleware (applied automatically in registerCaloriesTools) |
| `yyyyMmDdSchema`             | `../../shared/schemas`    | Zod schema for "YYYY-MM-DD" date strings                         |
| `today()`                    | `../../shared/dateUTils`  | Returns today's date as "YYYY-MM-DD"                             |
| `daysAgo(n)`                 | `../../shared/dateUTils`  | Returns "YYYY-MM-DD" for n days ago                              |

## Verification

After creating the files, verify by:

1. Building the package: `cd packages/mcp-server && npm run build` (or `tsc --noEmit`)
2. Confirming the new tool name appears in the registered tools list
3. Calling the tool via the MCP client (e.g. Claude with the calories MCP server connected)
