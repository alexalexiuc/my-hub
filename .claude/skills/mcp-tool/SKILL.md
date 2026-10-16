---
name: mcp-tool
description: |
  Use when designing, adding, changing or reviewing an MCP tool or resource in packages/mcp-server — "add a
  tool", "expose X to Claude", "add a resource", "the MCP should be able to…", "update the tool description".
  Covers task-oriented design, the file layout, defineTool/defineResource registration, annotations, errors,
  docs and how to verify. For a brand-new /api/<domain>/mcp endpoint run mcp-add-server first.
metadata:
  scope: mcp-server
  stage: design+implementation
---

# MCP tools and resources

## 1. Design (2 minutes, before code)

`pnpm --filter @my-hub/mcp-server list-tools <domain> --desc` shows the current surface. Then answer:

1. Which user intent ("log what I ate", "plan my leave") does this serve? Name it `<domain>_<intent>`
   (`travel_add_reservation_from_text`, `vacation_find_best_windows`) — not `<domain>_create_<table>`.
2. Do existing tools/resources already cover it? Is it plain CRUD the Hub already does? Then don't add it, unless
   Claude genuinely needs it to compose a workflow.
3. Tool or resource? **Resource** = read-only snapshot with no parameters (`calories://today`). **Tool** =
   parameters, writes, or anything Claude must be able to call reliably — some clients ignore resources, so
   important reads get a tool too (`calories_get_profile` mirrors `calories://profile`).
4. Inputs: camelCase, natural-language friendly, smart defaults (dates default to today in `context.timezone`),
   no opaque IDs when a name/date works. Outputs: a short summary of what happened + compact structured rows +
   `warnings` to relay.

## 2. Implement

Handler + schema in the domain's area file, `packages/mcp-server/src/<domain>/tools/<area>.ts` (shared reads
compose in `src/<domain>/models/`, DB access only via `@my-hub/shared/services`):

```ts
import { z } from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import type { ToolHandler } from '../../shared/types';

export const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

export const getDailySummaryTool: ToolHandler<typeof GetDailySummarySchema.shape> = async (
  input,
  { userId, timezone },
) => {
  const date = input.date ?? currentDateString(timezone);
  return toolResponse(await buildDailySummary(userId, date));
};
```

Register it in `src/<domain>/tools/tools.ts` — the array `register<Domain>Tools` passes to `registerTools`:

```ts
defineTool({
  name: 'calories_get_daily_summary',
  description: 'When to use it, what it returns, how it relates to other tools. Written for the model.',
  inputSchema: GetDailySummarySchema.shape,
  annotations: { readOnlyHint: true },
  callback: getDailySummaryTool,
}),
```

| Kind                      | annotations                                         |
| ------------------------- | --------------------------------------------------- |
| Read                      | `{ readOnlyHint: true }`                            |
| Write                     | `{ idempotentHint: false, destructiveHint: false }` |
| Delete / overwrite        | `{ idempotentHint: false, destructiveHint: true }`  |
| Upsert-by-key (safe redo) | `{ idempotentHint: true, destructiveHint: … }`      |

Resources: handler `ResourceHandler` in `src/<domain>/resources/<name>.ts` returning `resourceResponse(uri, payload)`;
register with `defineResource({ name: '<domain>-<name>', uri: '<domain>://<name>', description, mimeType:
'application/json', callback })` in that domain's resources file (`resources.ts`, travel: `resources/index.ts`).
Resources never write.

Rules: `context` is authenticated (`userId`, `timezone`, `clientId`, `serverName`); the optional third arg is the
raw SDK `ServerContext`. Never call `wrapToolHandler` yourself. User-facing failures: `HandledError` or the
service's `UserInputError` — no try/catch. Update descriptions of neighbouring tools that should now point at the
new one.

## 3. Verify and document

- `pnpm --filter @my-hub/mcp-server list-tools <domain>` — the new name appears with the right annotations.
- `pnpm exec turbo run typecheck lint test:unit --filter=@my-hub/mcp-server --output-logs=errors-only`.
- E2E in `packages/mcp-server/e2e/<domain>*.e2e.ts` (`createMcpClient` / `callTool`; tag data with a run id, clean
  up in `afterAll`). Run it locally with the `e2e-tests` skill.
- Docs: tool list in `docs/requirements/mcps/feature-<domain>.md` (FR/TR rows + acceptance criteria) and the
  README's tool table if the domain is listed there.
