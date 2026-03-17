# Feature: MCP Server Control

| Field    | Value                        |
| -------- | ---------------------------- |
| Status   | draft                        |
| Priority | medium                       |
| File     | `hub/feature-mcp-control.md` |

---

## Summary

The MCP Control section of the Hub admin panel lets the owner enable or disable
individual MCP sub-servers on a per-user basis. This gives fine-grained control over
which AI tools are active without requiring a server restart or code change — useful
when adding a new MCP module that should not yet be exposed, or when disabling a
broken sub-server while a fix is deployed.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The admin must be able to see a list of all registered MCP sub-servers (e.g. Hive Manager, Calorie Tracker, Products Manager) and their current enabled/disabled state. |
| FR-02 | The admin must be able to toggle a sub-server on or off with a single UI interaction (e.g. a toggle switch).                                                            |
| FR-03 | When a sub-server is disabled, requests to its MCP route must return an appropriate error (e.g. HTTP 503 or an MCP-level error) and not execute any tool handlers.      |
| FR-04 | When a sub-server is re-enabled, it must begin accepting requests immediately without requiring a process restart.                                                      |
| FR-05 | The enabled/disabled state must persist across server restarts (stored in the database, not in memory).                                                                 |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | The enabled/disabled state per sub-server (and optionally per user) is stored in the PostgreSQL database via a Drizzle-managed table in `packages/shared/src/db/schema`. |
| TR-02 | The Fastify MCP app reads the enabled state from the database (or a short-lived cache) on each request to decide whether to route to the sub-server.                     |
| TR-03 | The admin panel page lives in `packages/hub`; state changes are applied via a Next.js Server Action or API route that writes to the database.                            |
| TR-04 | Only authenticated admin users can access the MCP Control page.                                                                                                          |
| TR-05 | Cache invalidation (if any caching is applied to the enabled state) must happen within 5 seconds of a toggle in the admin panel.                                         |

---

## Open Questions

- [ ] Is control per-user (user A has Hive Manager enabled, user B does not) or global (disable for everyone)?
- [ ] Should there be a "maintenance mode" message shown to AI clients when a sub-server is disabled, rather than a generic error?
- [ ] Should enable/disable actions be logged in an audit trail?

---

## Acceptance Criteria

- [ ] All registered MCP sub-servers are listed on the control page with their current state.
- [ ] Disabling a sub-server causes subsequent MCP tool calls to that sub-server to fail with a clear error within 5 seconds.
- [ ] Re-enabling a sub-server causes tool calls to succeed again without restarting the Fastify process.
- [ ] The enabled state survives a server restart.
- [ ] Accessing the MCP Control page while unauthenticated redirects to the login page.
