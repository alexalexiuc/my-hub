---
name: mcp-add-resource
description: |
  This skill should be used when the user asks to "add a resource", "create a resource",
  "add a new MCP resource", "create a new MCP resource", "implement a resource", or asks
  to expose data as a readable resource on the MCP server (as opposed to a tool).
  Applies to MCP servers in this repository.
metadata:
  scope: mcp-server
  stage: implementation
---

# Adding a New MCP Resource

Resources are read-only data endpoints identified by a URI (e.g. `calories://today`).
They differ from tools in that they take no user-supplied input — Claude reads them
to get context. Adding a resource requires changes to two places: a new implementation
file and a registration entry in `resources/index.ts`.

## Step 1 — Create the implementation file

Create `packages/mcp-server/src/calories/resources/<name>.ts`.

**Required imports:**

```typescript
import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resourceResponse } from '../../shared/resourcesUtils';
// Add any shared service imports from '@my-hub/shared/services' as needed
```

**Implement the callback** typed as `ReadResourceCallback`:

```typescript
export const getMyDataResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  // userId is not optional here — resources always require authentication
  // (unless skipUserIdCheck: true is set in the registration)

  // ... fetch data, compute, etc.

  return resourceResponse(uri, {
    /* structured output */
  });
};
```

Key rules:

- Always extract `userId` from `extra.authInfo?.extra?.['userId']`.
- Return via `resourceResponse(uri, payload)` — this wraps the payload as MCP resource content
  with `mimeType: 'application/json'` and pretty-printed JSON.
- Resources are read-only by convention; never write to the database from a resource callback.
- Keep the returned object flat and descriptive — it will be read by the AI model as context.

**Minimal real example** (`today.ts`):

```typescript
import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildDailySummary } from '../models/daily';
import { today } from '../../shared/dateUTils';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getTodayResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const summary = await buildDailySummary(userId, today());
  return resourceResponse(uri, summary);
};
```

## Step 2 — Register in `resources/index.ts`

File: `packages/mcp-server/src/calories/resources/index.ts`

1. **Add import** at the top alongside the other resource imports:

```typescript
import { getMyDataResource } from './my-data';
```

2. **Add a `defineResource` entry** to the `caloriesResources` array:

```typescript
defineResource({
  name: 'calories-my-data',            // kebab-case, prefixed with 'calories-'
  uri: 'calories://my-data',           // URI must use 'calories://' scheme
  description:
    'One paragraph description for the AI model. Explain what data this resource ' +
    'exposes, when to read it, and how it relates to other resources or tools.',
  mimeType: 'application/json',
  callback: getMyDataResource,
  // skipUserIdCheck: true,            // only for truly public resources (no user data)
}),
```

## Shared utilities reference

| Utility                           | Location                      | Purpose                                                              |
| --------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `resourceResponse(uri, payload)`  | `../../shared/resourcesUtils` | Wrap any object as MCP resource response                             |
| `defineResource(def)`             | `../../shared/toolsUtils`     | Type-safe resource definition (used in index.ts)                     |
| `withUserIdCheckResource(cb)`     | `../../shared/toolsUtils`     | Auth middleware (applied automatically in registerCaloriesResources) |
| `today()`                         | `../../shared/dateUTils`      | Returns today's date as "YYYY-MM-DD"                                 |
| `daysAgo(n)`                      | `../../shared/dateUTils`      | Returns "YYYY-MM-DD" for n days ago                                  |
| `buildDailySummary(userId, date)` | `../models/daily`             | Full daily summary (meals + targets + macros)                        |
| `getWeekBounds(dateStr)`          | `../models/summary`           | Monday–Sunday bounds for a given date                                |
| `sumMeals(meals)`                 | `../models/summary`           | Aggregate calories + macros from a meals array                       |

## Tools vs Resources — when to use which

Use a **resource** when:

- The data has a stable, addressable identity (today's summary, this week's data, the user profile)
- No input parameters are needed beyond the user's identity
- Claude should read the data as background context before acting

Use a **tool** when:

- The operation requires user-supplied parameters (a date, an ID, a filter)
- The operation writes or mutates data
- The operation is an action rather than a data lookup

## Verification

After creating the files, verify by:

1. Building the package: `cd packages/mcp-server && npm run build` (or `tsc --noEmit`)
2. Confirming the new resource URI appears in the registered resources list
3. Reading the resource via the MCP client (e.g. Claude with the calories MCP server connected)
