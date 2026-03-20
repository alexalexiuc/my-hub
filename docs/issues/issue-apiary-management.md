# Implement Apiary Management MCP Server, Hub UI & API

## Summary

Build a full-stack **Apiary Management** feature that lets beekeepers manage yards, hives, inspection logs, and tasks through both the MCP server (for AI clients like Claude) and the Hub web UI. This replaces the incomplete "Hive Manager" prototype (commented out in `server.ts:83`, old schema in `hive.ts` missing `userId`).

**Key decisions:**
- New `apiary_` prefixed tables — old `hives`/`hive_logs`/`hive_todos` tables are **NOT removed** (separate cleanup issue later)
- All tables include `userId` FK for multi-user support
- Introduces the **Yards** concept — beekeepers manage multiple physical locations; hives belong to yards
- JSONB `data` column on logs for type-specific payloads (inspection, treatment, feeding, harvest, etc.)

---

## 1. Database Schema

Create `packages/shared/src/db/schema/apiary.ts` with 4 new tables:

### 1.1 `apiary_yards`

| Column       | Type                  | Constraints                                     |
| ------------ | --------------------- | ----------------------------------------------- |
| `id`         | `serial`              | PK                                              |
| `user_id`    | `uuid`                | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `name`       | `text`                | NOT NULL (e.g. "Home Yard", "Mountain Apiary")  |
| `location`   | `text`                | nullable (address or GPS coordinates)           |
| `notes`      | `text`                | nullable                                        |
| `is_active`  | `boolean`             | NOT NULL, DEFAULT true                          |
| `created_at` | `timestamp`           | NOT NULL, DEFAULT now()                         |
| `updated_at` | `timestamp`           | NOT NULL, DEFAULT now()                         |

### 1.2 `apiary_hives`

| Column          | Type                  | Constraints                                     |
| --------------- | --------------------- | ----------------------------------------------- |
| `id`            | `serial`              | PK                                              |
| `user_id`       | `uuid`                | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `yard_id`       | `integer`             | nullable, FK → `apiary_yards.id` ON DELETE SET NULL |
| `name`          | `text`                | NOT NULL (e.g. "Hive #3", "Blue Hive")         |
| `queen_status`  | `text`                | nullable (e.g. "queenright", "queenless", "requeened") |
| `queen_marked`  | `boolean`             | nullable                                        |
| `queen_year`    | `integer`             | nullable (year queen was introduced)            |
| `boxes`         | `integer`             | nullable (number of boxes/supers)               |
| `notes`         | `text`                | nullable                                        |
| `is_active`     | `boolean`             | NOT NULL, DEFAULT true                          |
| `created_at`    | `timestamp`           | NOT NULL, DEFAULT now()                         |
| `updated_at`    | `timestamp`           | NOT NULL, DEFAULT now()                         |

### 1.3 `apiary_logs`

| Column       | Type                  | Constraints                                     |
| ------------ | --------------------- | ----------------------------------------------- |
| `id`         | `serial`              | PK                                              |
| `user_id`    | `uuid`                | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `hive_id`    | `integer`             | nullable, FK → `apiary_hives.id` ON DELETE SET NULL |
| `logged_at`  | `timestamp`           | NOT NULL, DEFAULT now()                         |
| `type`       | `text`                | NOT NULL — one of: `inspection`, `treatment`, `feeding`, `harvest`, `relocation`, `queen_event`, `note` |
| `notes`      | `text`                | nullable                                        |
| `data`       | `jsonb`               | nullable — type-specific payload (see §1.5)     |
| `created_at` | `timestamp`           | NOT NULL, DEFAULT now()                         |

### 1.4 `apiary_tasks`

| Column        | Type                  | Constraints                                     |
| ------------- | --------------------- | ----------------------------------------------- |
| `id`          | `serial`              | PK                                              |
| `user_id`     | `uuid`                | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `hive_id`     | `integer`             | nullable, FK → `apiary_hives.id` ON DELETE SET NULL |
| `title`       | `text`                | NOT NULL                                        |
| `completed`   | `boolean`             | NOT NULL, DEFAULT false                         |
| `due_at`      | `timestamp`           | nullable                                        |
| `created_at`  | `timestamp`           | NOT NULL, DEFAULT now()                         |

### 1.5 JSONB `data` Payloads by Log Type

Each log `type` uses a different payload shape in the `data` column. These are **not enforced by the DB** — validation happens in the service/tool layer.

| Type           | Example `data` payload                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| `inspection`   | `{ "temperament": "calm", "brood_pattern": "solid", "queen_seen": true, "disease_signs": null, "population": "strong" }` |
| `treatment`    | `{ "product": "Apivar", "method": "strip", "duration_days": 42 }`           |
| `feeding`      | `{ "feed_type": "sugar_syrup", "ratio": "1:1", "amount_liters": 2 }`        |
| `harvest`      | `{ "frames": 6, "weight_kg": 18.5, "honey_type": "wildflower" }`            |
| `relocation`   | `{ "from_yard": "Home Yard", "to_yard": "Mountain Apiary", "reason": "summer flow" }` |
| `queen_event`  | `{ "event": "requeened", "queen_source": "local breeder", "marked": true, "color": "blue" }` |
| `note`         | `{}` (use the `notes` text column)                                           |

### 1.6 Schema Registration

- Export all 4 tables from `packages/shared/src/db/schema/apiary.ts`
- Add `export * from './apiary';` to `packages/shared/src/db/schema/index.ts`
- Add `Apiary: 'apiary'` to `McpServerName` in `packages/shared/src/db/schema/mcp-servers.ts`
- Add `'apiary'` to the `mcpServerEnum` values array
- Run `pnpm db:generate` to create migration files

---

## 2. Shared Services

Create `packages/shared/src/services/apiary/` with the following service files. Follow the same pattern as `packages/shared/src/services/calories/` and `packages/shared/src/services/todos.ts`.

### 2.1 `yards.ts`

| Function                                           | Description                          |
| -------------------------------------------------- | ------------------------------------ |
| `getYards(userId: string)`                         | List all yards for user              |
| `getYard(userId: string, yardId: number)`          | Get single yard                      |
| `createYard(userId: string, data: NewYard)`        | Create yard                          |
| `updateYard(userId: string, yardId: number, data)` | Update yard                          |
| `deleteYard(userId: string, yardId: number)`       | Delete yard (cascade handled by DB)  |

### 2.2 `hives.ts`

| Function                                              | Description                           |
| ----------------------------------------------------- | ------------------------------------- |
| `getHives(userId: string, opts?: { yardId?, active?})` | List hives with optional filters     |
| `getHive(userId: string, hiveId: number)`             | Get single hive                       |
| `createHive(userId: string, data: NewHive)`           | Create hive                           |
| `updateHive(userId: string, hiveId: number, data)`    | Update hive                           |
| `deleteHive(userId: string, hiveId: number)`          | Delete hive                           |

### 2.3 `logs.ts`

| Function                                                                    | Description                              |
| --------------------------------------------------------------------------- | ---------------------------------------- |
| `getLogs(userId: string, opts?: { hiveId?, type?, limit?, offset? })`       | List logs with optional filters          |
| `getLog(userId: string, logId: number)`                                     | Get single log                           |
| `createLog(userId: string, data: NewLog)`                                   | Create log entry                         |
| `deleteLog(userId: string, logId: number)`                                  | Delete log entry                         |

### 2.4 `tasks.ts`

| Function                                                                    | Description                              |
| --------------------------------------------------------------------------- | ---------------------------------------- |
| `getTasks(userId: string, opts?: { hiveId?, completed?, limit? })`          | List tasks with optional filters         |
| `createTask(userId: string, data: NewTask)`                                 | Create task                              |
| `updateTask(userId: string, taskId: number, data: Partial<Task>)`           | Update task (title, completed, due_at)   |
| `deleteTask(userId: string, taskId: number)`                                | Delete task                              |

### 2.5 `summary.ts`

| Function                                  | Description                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `getApiarySummary(userId: string)`        | Returns counts (yards, hives, pending tasks), recent logs, upcoming tasks |

### 2.6 Types

Add to `packages/shared/src/types/index.ts`:

```typescript
// Apiary types
export type ApiaryYard = typeof import('../db/schema/apiary').apiaryYards.$inferSelect;
export type NewApiaryYard = typeof import('../db/schema/apiary').apiaryYards.$inferInsert;
export type ApiaryHive = typeof import('../db/schema/apiary').apiaryHives.$inferSelect;
export type NewApiaryHive = typeof import('../db/schema/apiary').apiaryHives.$inferInsert;
export type ApiaryLog = typeof import('../db/schema/apiary').apiaryLogs.$inferSelect;
export type NewApiaryLog = typeof import('../db/schema/apiary').apiaryLogs.$inferInsert;
export type ApiaryTask = typeof import('../db/schema/apiary').apiaryTasks.$inferSelect;
export type NewApiaryTask = typeof import('../db/schema/apiary').apiaryTasks.$inferInsert;
```

Export the service barrel from `packages/shared/src/services/index.ts`.

---

## 3. MCP Tools (12 tools)

Create `packages/mcp-server/src/apiary/` with the same structure as `packages/mcp-server/src/calories/`:

```
packages/mcp-server/src/apiary/
├── server.ts              # createApiaryServer() — same pattern as calories/server.ts
├── tools/
│   ├── index.ts           # registerApiaryTools(server)
│   ├── tools.ts           # Tool definitions array + registration
│   ├── yards.ts           # Yard tool callbacks
│   ├── hives.ts           # Hive tool callbacks
│   ├── logs.ts            # Log tool callbacks
│   └── tasks.ts           # Task tool callbacks
└── resources/
    ├── index.ts           # registerApiaryResources(server)
    ├── resources.ts       # Resource definitions array + registration
    ├── summary.ts         # Summary resource callback
    ├── hives.ts           # Hives resource callback
    └── tasks.ts           # Tasks resource callback
```

Use `defineTool()`, `withUserIdCheck()`, `toolResponse()` from `../../shared/toolsUtils.ts`.
Use `defineResource()`, `withUserIdCheckResource()` from `../../shared/toolsUtils.ts`.
Use `resourceResponse()` from `../../shared/resourcesUtils.ts`.

### 3.1 Tool Definitions

All tool names use the `apiary_` prefix. Input schemas use Zod.

#### Yard Tools

| Tool Name              | Description                                                    | Input Schema                                          | Annotations                                     |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `apiary_create_yard`   | Create a new yard (physical location where hives are kept)     | `{ name: string, location?: string, notes?: string }` | `{ idempotentHint: false, destructiveHint: false }` |
| `apiary_list_yards`    | List all yards for the authenticated user                      | `{}` (no input)                                       | `{ readOnlyHint: true }`                        |
| `apiary_update_yard`   | Update an existing yard's details                              | `{ yard_id: number, name?: string, location?: string, notes?: string, is_active?: boolean }` | `{ idempotentHint: false, destructiveHint: false }` |

#### Hive Tools

| Tool Name               | Description                                                   | Input Schema                                          | Annotations                                     |
| ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `apiary_create_hive`    | Register a new hive. Optionally assign to a yard.             | `{ name: string, yard_id?: number, queen_status?: string, queen_marked?: boolean, queen_year?: number, boxes?: number, notes?: string }` | `{ idempotentHint: false, destructiveHint: false }` |
| `apiary_list_hives`     | List hives with optional filters by yard and active status    | `{ yard_id?: number, active?: boolean }`              | `{ readOnlyHint: true }`                        |
| `apiary_update_hive`    | Update hive details (queen info, boxes, yard assignment, etc.) | `{ hive_id: number, name?: string, yard_id?: number, queen_status?: string, queen_marked?: boolean, queen_year?: number, boxes?: number, notes?: string, is_active?: boolean }` | `{ idempotentHint: false, destructiveHint: false }` |

#### Log Tools

| Tool Name              | Description                                                    | Input Schema                                          | Annotations                                     |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `apiary_log_event`     | Record a hive event (inspection, treatment, feeding, harvest, relocation, queen_event, or note). The `data` field holds type-specific details — see the JSONB payload table in the schema section. | `{ hive_id?: number, type: "inspection" \| "treatment" \| "feeding" \| "harvest" \| "relocation" \| "queen_event" \| "note", notes?: string, data?: object, logged_at?: string (YYYY-MM-DD) }` | `{ idempotentHint: false, destructiveHint: false }` |
| `apiary_get_logs`      | Retrieve event logs with optional filters. Returns newest first. | `{ hive_id?: number, type?: string, limit?: number (default 50, max 200), offset?: number }` | `{ readOnlyHint: true }` |
| `apiary_delete_log`    | Delete a log entry by ID.                                      | `{ log_id: number }`                                  | `{ idempotentHint: false, destructiveHint: true }` |

#### Task Tools

| Tool Name                | Description                                                  | Input Schema                                          | Annotations                                     |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------- |
| `apiary_create_task`     | Create a beekeeping task, optionally tied to a specific hive | `{ title: string, hive_id?: number, due_at?: string (YYYY-MM-DD) }` | `{ idempotentHint: false, destructiveHint: false }` |
| `apiary_complete_task`   | Mark a task as completed                                     | `{ task_id: number }`                                 | `{ idempotentHint: true, destructiveHint: false }` |
| `apiary_delete_task`     | Delete a task by ID                                          | `{ task_id: number }`                                 | `{ idempotentHint: false, destructiveHint: true }` |

### 3.2 Server Registration

In `packages/mcp-server/src/server.ts`:
1. Import `createApiaryServer` from `./apiary/server.js`
2. Replace the commented-out hive line (line 83) with:
   ```typescript
   registerMcpSubServer(app, '/api/apiary/mcp', McpServerName.Apiary, createApiaryServer);
   ```

---

## 4. MCP Resources (3 resources)

| Name              | URI                  | Description                                                                          | MIME Type          |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| `apiary-summary`  | `apiary://summary`   | Overview: yard count, hive count, pending task count, 5 most recent logs, 5 upcoming tasks | `application/json` |
| `apiary-hives`    | `apiary://hives`     | All active hives with their yard name, queen status, and box count                   | `application/json` |
| `apiary-tasks`    | `apiary://tasks`     | All pending (uncompleted) tasks, sorted by due date (soonest first), with hive name  | `application/json` |

---

## 5. Hub API Routes

Create Next.js API routes under `packages/hub/src/app/api/apiary/`. Follow the pattern in `packages/hub/src/app/api/todo/route.ts` (use `getAuthUser()` for auth).

| Route                              | Methods       | Description                           |
| ---------------------------------- | ------------- | ------------------------------------- |
| `/api/apiary/summary`              | GET           | Returns `getApiarySummary(userId)`    |
| `/api/apiary/yards`                | GET, POST     | List / create yards                   |
| `/api/apiary/yards/[id]`           | GET, PATCH, DELETE | Get / update / delete yard       |
| `/api/apiary/hives`                | GET, POST     | List / create hives                   |
| `/api/apiary/hives/[id]`           | GET, PATCH, DELETE | Get / update / delete hive       |
| `/api/apiary/logs`                 | GET, POST     | List / create logs                    |
| `/api/apiary/logs/[id]`            | DELETE        | Delete log                            |
| `/api/apiary/tasks`                | GET, POST     | List / create tasks                   |
| `/api/apiary/tasks/[id]`           | PATCH, DELETE | Update (complete) / delete task       |

---

## 6. Hub UI

Create `packages/hub/src/app/apiary/page.tsx` — a tabbed interface with 4 tabs.

### 6.1 Tab Structure

```
packages/hub/src/app/apiary/
├── page.tsx                 # Main page with tab navigation
├── dashboard-tab.tsx        # Dashboard/overview tab
├── hives-tab.tsx            # Hives management tab
├── log-tab.tsx              # Event log tab
└── tasks-tab.tsx            # Tasks tab
```

### 6.2 Tab Details

**Dashboard Tab** (default):
- Summary cards: total yards, total hives, pending tasks
- Recent activity: last 5 log entries with hive name, type badge, date
- Upcoming tasks: next 5 tasks sorted by due date
- Optional: simple chart showing log entries per week (last 8 weeks) using Recharts

**Hives Tab**:
- Table/card list of all hives grouped by yard
- Each hive shows: name, yard, queen status, boxes, last inspection date
- "Add Hive" button → inline form or modal
- Click hive → expand to show recent logs for that hive

**Log Tab**:
- Reverse-chronological feed of all log entries
- Filter by: hive (dropdown), type (multi-select badges)
- "Add Entry" button → form with type selector, hive selector, notes, optional date
- Type-specific `data` fields shown in a detail panel

**Tasks Tab**:
- List of tasks with checkbox to mark complete
- Filter: pending / completed / all
- "Add Task" button → inline form with title, optional hive, optional due date
- Overdue tasks highlighted

### 6.3 Dashboard Integration

Add to `appSections` in `packages/hub/src/app/page.tsx`:

```typescript
{
  href: '/apiary',
  label: 'Apiary',
  description: 'Manage bee yards, hives, inspections & tasks',
  color: 'bg-amber-950/30 border-amber-800/50 hover:border-amber-600/70',
  labelColor: 'text-amber-400',
},
```

### 6.4 UI Components

Use existing components from `packages/hub/src/components/`:
- `PageHeader` for the page title
- `SectionCard` for card containers
- `Button`, `Field` for forms
- Recharts (already a dependency) for any charts
- Tailwind CSS for styling — follow existing dark theme patterns

---

## 7. Documentation

### 7.1 Feature Spec

Create `docs/requirements/mcps/feature-apiary-management.md` following the FR/TR template (see `docs/requirements/_template.md`). Include:
- All 12 tools with their exact names and descriptions
- All 3 resources with URIs
- All Hub routes
- Acceptance criteria (checkboxes)

### 7.2 Update References

- Update `PLATFORM_REQUIREMENTS.md` to list the Apiary MCP server alongside Calories and Todo
- Old `docs/requirements/mcps/feature-hive-manager.md` stays for now (add a note pointing to the new doc)

---

## 8. Implementation Order

Follow `AGENTS.md` mandated change order:

1. **`packages/shared`** — schema, types, services
2. **`packages/mcp-server`** — MCP server, tools, resources, server registration
3. **`packages/hub`** — API routes, UI page, dashboard integration
4. **`docs/`** — feature spec, platform requirements update

---

## 9. Complete File List

### CREATE (new files)

| File                                                          | Description                  |
| ------------------------------------------------------------- | ---------------------------- |
| `packages/shared/src/db/schema/apiary.ts`                    | 4 new tables                 |
| `packages/shared/src/services/apiary/index.ts`               | Service barrel export        |
| `packages/shared/src/services/apiary/yards.ts`               | Yard service functions       |
| `packages/shared/src/services/apiary/hives.ts`               | Hive service functions       |
| `packages/shared/src/services/apiary/logs.ts`                | Log service functions        |
| `packages/shared/src/services/apiary/tasks.ts`               | Task service functions       |
| `packages/shared/src/services/apiary/summary.ts`             | Summary aggregation          |
| `packages/mcp-server/src/apiary/server.ts`                   | createApiaryServer()         |
| `packages/mcp-server/src/apiary/tools/index.ts`              | Tool barrel export           |
| `packages/mcp-server/src/apiary/tools/tools.ts`              | Tool definitions + register  |
| `packages/mcp-server/src/apiary/tools/yards.ts`              | Yard tool callbacks          |
| `packages/mcp-server/src/apiary/tools/hives.ts`              | Hive tool callbacks          |
| `packages/mcp-server/src/apiary/tools/logs.ts`               | Log tool callbacks           |
| `packages/mcp-server/src/apiary/tools/tasks.ts`              | Task tool callbacks          |
| `packages/mcp-server/src/apiary/resources/index.ts`          | Resource barrel export       |
| `packages/mcp-server/src/apiary/resources/resources.ts`      | Resource definitions + register |
| `packages/mcp-server/src/apiary/resources/summary.ts`        | Summary resource callback    |
| `packages/mcp-server/src/apiary/resources/hives.ts`          | Hives resource callback      |
| `packages/mcp-server/src/apiary/resources/tasks.ts`          | Tasks resource callback      |
| `packages/hub/src/app/apiary/page.tsx`                       | Main apiary page             |
| `packages/hub/src/app/apiary/dashboard-tab.tsx`              | Dashboard tab component      |
| `packages/hub/src/app/apiary/hives-tab.tsx`                  | Hives tab component          |
| `packages/hub/src/app/apiary/log-tab.tsx`                    | Log tab component            |
| `packages/hub/src/app/apiary/tasks-tab.tsx`                  | Tasks tab component          |
| `packages/hub/src/app/api/apiary/summary/route.ts`           | Summary API route            |
| `packages/hub/src/app/api/apiary/yards/route.ts`             | Yards list/create route      |
| `packages/hub/src/app/api/apiary/yards/[id]/route.ts`        | Yard CRUD route              |
| `packages/hub/src/app/api/apiary/hives/route.ts`             | Hives list/create route      |
| `packages/hub/src/app/api/apiary/hives/[id]/route.ts`        | Hive CRUD route              |
| `packages/hub/src/app/api/apiary/logs/route.ts`              | Logs list/create route       |
| `packages/hub/src/app/api/apiary/logs/[id]/route.ts`         | Log delete route             |
| `packages/hub/src/app/api/apiary/tasks/route.ts`             | Tasks list/create route      |
| `packages/hub/src/app/api/apiary/tasks/[id]/route.ts`        | Task update/delete route     |
| `docs/requirements/mcps/feature-apiary-management.md`        | Feature spec document        |

### MODIFY (existing files)

| File                                                          | Change                                                |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/shared/src/db/schema/index.ts`                     | Add `export * from './apiary';`                       |
| `packages/shared/src/db/schema/mcp-servers.ts`               | Add `Apiary: 'apiary'` to `McpServerName` + enum     |
| `packages/shared/src/types/index.ts`                         | Add Apiary type exports                               |
| `packages/shared/src/services/index.ts`                      | Add `export * from './apiary';`                       |
| `packages/mcp-server/src/server.ts`                          | Import + register apiary sub-server, remove commented hive line |
| `packages/hub/src/app/page.tsx`                              | Add Apiary to `appSections` array                     |
| `docs/requirements/mcps/feature-hive-manager.md`             | Add note: "Superseded by feature-apiary-management.md" |
| `PLATFORM_REQUIREMENTS.md`                                   | Add Apiary server to MCP server listing               |

---

## 10. Verification Checklist

After implementation, verify:

- [ ] `pnpm db:generate` creates migration files for the 4 new `apiary_` tables
- [ ] `pnpm db:migrate` applies cleanly
- [ ] MCP server starts and apiary sub-server is registered at `/api/apiary/mcp`
- [ ] All 12 tools are callable via authenticated MCP client
- [ ] All 3 resources are readable
- [ ] Hub UI at `/apiary` renders with 4 working tabs
- [ ] Dashboard shows Apiary app card
- [ ] All API routes return correct data for authenticated user
- [ ] Unauthenticated requests return 401
- [ ] `pnpm typecheck` passes across all packages
- [ ] Feature spec document created
- [ ] `PLATFORM_REQUIREMENTS.md` updated

---

## 11. Use Cases for Validation

Test the implementation against these real beekeeper scenarios:

1. **Spring setup**: Create 2 yards ("Home" and "Farm"), add 4 hives split between them, log initial inspections for each
2. **Weekly inspection**: Log inspection for Hive #3 with `data: { temperament: "calm", brood_pattern: "spotty", queen_seen: false, disease_signs: "possible chalkbrood" }`
3. **Treatment cycle**: Log a treatment event with `data: { product: "Formic Pro", method: "pad", duration_days: 14 }`, create a follow-up task "Remove Formic Pro pads" due in 14 days
4. **Harvest day**: Log harvest for 3 hives with frame counts and weights
5. **Seasonal move**: Log relocation of 2 hives from Home to Farm yard, update their yard_id
6. **Task management**: Create tasks for "Order new queens", "Build 4 frames", "Schedule varroa count" with various due dates, complete some, filter by pending
7. **Dashboard review**: Via Claude MCP: "How are my bees doing?" → reads `apiary://summary` resource, provides overview
