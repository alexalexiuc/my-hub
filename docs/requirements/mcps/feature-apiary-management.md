# Feature: Apiary Management

| Field    | Value                                           |
| -------- | ----------------------------------------------- |
| Status   | implemented                                     |
| Priority | high                                            |
| File     | `mcps/feature-apiary-management.md`             |

---

## Summary

The Apiary Management feature lets beekeepers manage yards, hives, inspection logs, and tasks through both the MCP server (for AI clients like Claude) and the Hub web UI. It replaces the incomplete "Hive Manager" prototype.

Key design decisions:
- New `apiary_` prefixed tables — old `hives`/`hive_logs`/`hive_todos` tables are **not removed** (separate cleanup issue later)
- All tables include `userId` FK for multi-user support
- Introduces the **Yards** concept — beekeepers manage multiple physical locations; hives belong to yards
- JSONB `data` column on logs for type-specific payloads (inspection, treatment, feeding, harvest, etc.)

---

## Functional Requirements

| ID    | Requirement                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------- |
| FR-01 | Users can create, list, and update **yards** (physical locations where hives are kept).                  |
| FR-02 | Users can create, list, and update **hives**, optionally assigning them to a yard.                       |
| FR-03 | Users can log **events** (inspection, treatment, feeding, harvest, relocation, queen_event, note) with type-specific JSONB data payloads. |
| FR-04 | Users can create, complete, and delete **tasks**, optionally tied to a specific hive.                    |
| FR-05 | A **summary** endpoint/resource returns yard count, hive count, pending task count, recent logs, and upcoming tasks. |
| FR-06 | All data is scoped to the authenticated user (multi-user support via `userId` FK).                       |
| FR-07 | The MCP server exposes 12 tools and 3 resources for AI client interaction.                               |
| FR-08 | The Hub UI provides a tabbed interface with Dashboard, Hives, Log, and Tasks tabs.                       |
| FR-09 | The Hub dashboard page (`/`) shows an Apiary app card linking to `/apiary`.                              |

---

## Technical Requirements

| ID    | Requirement                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------- |
| TR-01 | Schema: 4 new tables (`apiary_yards`, `apiary_hives`, `apiary_logs`, `apiary_tasks`) in `packages/shared/src/db/schema/apiary.ts`. |
| TR-02 | Services: `packages/shared/src/services/apiary/` with yards, hives, logs, tasks, and summary modules.   |
| TR-03 | MCP server: `packages/mcp-server/src/apiary/` registered at `/api/apiary/mcp` with `McpServerName.Apiary`. |
| TR-04 | Hub API: RESTful routes under `packages/hub/src/app/api/apiary/` using `getAuthUser()` for auth.        |
| TR-05 | Hub UI: `packages/hub/src/app/apiary/page.tsx` with client-side tab navigation.                          |
| TR-06 | All DB queries live in `packages/shared/src/services/apiary/` — no raw Drizzle calls in mcp-server or hub. |
| TR-07 | `McpServerName` enum and `mcpServerEnum` updated with `Apiary: 'apiary'`.                               |

---

## MCP Tools (12)

| Tool Name              | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `apiary_create_yard`   | Create a new yard (physical location where hives are kept)                     |
| `apiary_list_yards`    | List all yards for the authenticated user                                      |
| `apiary_update_yard`   | Update an existing yard's details                                              |
| `apiary_create_hive`   | Register a new hive, optionally assigned to a yard                             |
| `apiary_list_hives`    | List hives with optional filters by yard and active status                     |
| `apiary_update_hive`   | Update hive details (queen info, boxes, yard assignment, etc.)                 |
| `apiary_log_event`     | Record a hive event (inspection, treatment, feeding, harvest, etc.)            |
| `apiary_get_logs`      | Retrieve event logs with optional filters, newest first                        |
| `apiary_delete_log`    | Delete a log entry by ID                                                       |
| `apiary_create_task`   | Create a beekeeping task, optionally tied to a specific hive                   |
| `apiary_complete_task` | Mark a task as completed                                                       |
| `apiary_delete_task`   | Delete a task by ID                                                            |

---

## MCP Resources (3)

| Name             | URI                | Description                                                                           |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `apiary-summary` | `apiary://summary` | Overview: yard count, hive count, pending task count, 5 recent logs, 5 upcoming tasks |
| `apiary-hives`   | `apiary://hives`   | All active hives with yard name, queen status, and box count                          |
| `apiary-tasks`   | `apiary://tasks`   | All pending tasks, sorted by due date, with hive name                                 |

---

## Hub API Routes

| Route                         | Methods        | Description                   |
| ----------------------------- | -------------- | ----------------------------- |
| `/api/apiary/summary`         | GET            | Apiary summary                |
| `/api/apiary/yards`           | GET, POST      | List / create yards           |
| `/api/apiary/yards/[id]`      | GET, PATCH, DELETE | Get / update / delete yard |
| `/api/apiary/hives`           | GET, POST      | List / create hives           |
| `/api/apiary/hives/[id]`      | GET, PATCH, DELETE | Get / update / delete hive |
| `/api/apiary/logs`            | GET, POST      | List / create logs            |
| `/api/apiary/logs/[id]`       | DELETE         | Delete log                    |
| `/api/apiary/tasks`           | GET, POST      | List / create tasks           |
| `/api/apiary/tasks/[id]`      | PATCH, DELETE  | Update / delete task          |

---

## Acceptance Criteria

- [x] Schema: 4 new `apiary_` tables defined in `packages/shared/src/db/schema/apiary.ts`
- [x] Schema exported from `packages/shared/src/db/schema/index.ts`
- [x] `McpServerName.Apiary` added to enum and `mcpServerEnum` values
- [x] Types: `ApiaryYard`, `ApiaryHive`, `ApiaryLog`, `ApiaryTask` (+ New* variants) exported from types
- [x] Services: 5 service modules in `packages/shared/src/services/apiary/`
- [x] Services exported from `packages/shared/src/services/index.ts`
- [x] MCP server: `createApiaryServer()` with 12 tools and 3 resources
- [x] MCP server registered at `/api/apiary/mcp` in `server.ts`
- [x] Hub API: 9 route files under `packages/hub/src/app/api/apiary/`
- [x] Hub UI: Tabbed page at `/apiary` with Dashboard, Hives, Log, and Tasks tabs
- [x] Dashboard: Apiary app card added to `appSections` in `page.tsx`
- [x] `pnpm typecheck` passes across all packages
- [x] Feature spec document created
- [x] `PLATFORM_REQUIREMENTS.md` updated
- [x] Old hive-manager doc updated with superseded note
