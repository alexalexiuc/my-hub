# Feature: MCP Server Control

| Field    | Value                        |
| -------- | ---------------------------- |
| Status   | implemented                  |
| Priority | medium                       |
| File     | `hub/feature-mcp-control.md` |

---

## Summary

The MCP Control section of the Hub admin panel (`/mcp-control`) lets the owner enable
or disable individual MCP sub-servers on a per-user basis, and manage OAuth client
credentials (Connections). This gives fine-grained control over which AI tools are
active without requiring a server restart or code change — useful when adding a new MCP
module that should not yet be exposed, or when disabling a broken sub-server while a fix
is deployed.

Note: OAuth client management (create / toggle / revoke) is co-located on this page
rather than on a separate `/oauth-clients` route.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | The admin must be able to see a list of all registered MCP sub-servers (e.g. Calories, Todo, Apiary, Products) and their current enabled/disabled state.           |
| FR-02 | The admin must be able to toggle a sub-server on or off with a single UI interaction (e.g. a toggle switch).                                                       |
| FR-03 | When a sub-server is disabled, requests to its MCP route must return an appropriate error (e.g. HTTP 503 or an MCP-level error) and not execute any tool handlers. |
| FR-04 | When a sub-server is re-enabled, it must begin accepting requests immediately without requiring a process restart.                                                 |
| FR-05 | The enabled/disabled state must persist across server restarts (stored in the database, not in memory).                                                            |
| FR-06 | Inactive (not yet implemented) servers must be visually distinguished (reduced opacity, disabled toggle, "Coming soon" label).                                     |
| FR-07 | Each server card must display its full MCP URL with a copy button for active servers.                                                                              |
| FR-08 | An **Audit Log** section must allow users to review API request logs filtered by service, date range, and limit.                                                   |
| FR-09 | Audit log rows must be expandable to show request/response bodies and error details.                                                                               |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | The enabled/disabled state per sub-server (and optionally per user) is stored in the PostgreSQL database via a Drizzle-managed table in `packages/shared/src/db/schema`. |
| TR-02 | The Fastify MCP app reads the enabled state from the database (or a short-lived cache) on each request to decide whether to route to the sub-server.                     |
| TR-03 | The admin panel page lives in `packages/hub`; state changes are applied via a Next.js Server Action or API route that writes to the database.                            |
| TR-04 | Only authenticated admin users can access the MCP Control page.                                                                                                          |
| TR-05 | Cache invalidation (if any caching is applied to the enabled state) must happen within 5 seconds of a toggle in the admin panel.                                         |
| TR-06 | Hub MCP control API routes must enforce auth via a shared route-wrapper and may use a short-lived cache for DB user resolution to reduce repeated lookups.               |

---

## Open Questions

- [x] ~~Is control per-user or global?~~ Per-user — each user has their own `mcp_servers` rows.
- [ ] Should there be a "maintenance mode" message shown to AI clients when a sub-server is disabled, rather than a generic error?
- [x] ~~Should enable/disable actions be logged in an audit trail?~~ Yes — all API requests are logged in `api_request_logs` and viewable via the Audit Log section.

---

## Acceptance Criteria

- [x] All registered MCP sub-servers are listed on the control page with their current state.
- [x] Toggle switch UI allows enabling/disabling each active sub-server; state is persisted to the database via `/api/mcp/servers/:name`.
- [x] Inactive servers (Apiary, Products) are shown with reduced opacity, disabled toggles, and "Coming soon" labels.
- [x] Each server card displays the full MCP URL with a copy button.
- [ ] Disabling a sub-server causes subsequent MCP tool calls to that sub-server to fail with a clear error within 5 seconds.
- [ ] Re-enabling a sub-server causes tool calls to succeed again without restarting the Fastify process.
- [x] The enabled state survives a server restart (stored in `mcp_servers` DB table).
- [x] Accessing the MCP Control page while unauthenticated redirects to the login page.
- [x] Audit Log section shows API request logs with service/date/limit filters and expandable detail rows.
- [x] MCP control API routes (`/api/mcp/servers`, `/api/mcp/servers/:name`, `/api/mcp/clients`, `/api/mcp/clients/:id`, `/api/mcp/logs`) share a centralized auth wrapper instead of duplicating per-handler auth checks.
