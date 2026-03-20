# Feature: Hive Manager MCP

> **⚠️ Superseded by [`feature-apiary-management.md`](./feature-apiary-management.md).**
> The Apiary Management feature replaces this Hive Manager prototype with multi-user support, yards, and a richer tool/resource set.

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | superseded                     |
| Priority | high                           |
| File     | `mcps/feature-hive-manager.md` |

---

## Summary

The Hive Manager MCP server exposes beekeeping data to AI clients. It lets a user (via
Claude or another AI) log and query hive inspections, manage hive profiles, track todos,
and record hive relocations.

The Fastify implementation exists in `packages/mcp-server/src/` and the DB schema is
defined in `packages/shared/src/db/schema`. The sub-server registration is currently
commented out in `packages/mcp-server/src/server.ts` (line 83) pending full end-to-end
validation.

---

## Functional Requirements

| ID    | Requirement                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The server must expose MCP tools for logging hive inspection events (date, hive ID, observations, actions taken).      |
| FR-02 | The server must expose MCP tools for reading and updating hive profiles (hive ID, name, location, queen status, etc.). |
| FR-03 | The server must expose MCP tools for creating, listing, and completing hive-related todos.                             |
| FR-04 | The server must expose MCP tools for recording hive relocations (origin location, destination, date, reason).          |
| FR-05 | All tools must be scoped to the authenticated user — one user cannot access another user's hive data.                  |
| FR-06 | The server must be reachable at the `/mcp/hive/:userId` route of the shared MCP Fastify app.                           |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server` as a self-contained module (e.g. `src/servers/hive-manager/`).                                  |
| TR-02 | The DB schema for hive data (inspections, profiles, todos, relocations) must be defined in `packages/shared/src/db/schema` using Drizzle ORM. |
| TR-03 | Access is protected by OAuth 2.1 + PKCE; uses the shared OAuth implementation in `packages/mcp-server/src/routes/oauth.ts`.                   |
| TR-04 | ~~A one-time migration script must transfer existing data from Google Sheets to PostgreSQL before cutover.~~ Migration complete.              |
| TR-05 | ~~The Cloudflare Worker implementation remains running until the new platform is validated in staging.~~ Cloudflare Worker decommissioned.    |
| TR-06 | MCP transport must support both SSE and Streamable HTTP as offered by the MCP SDK.                                                            |

---

## Open Questions

- [ ] Which MCP tool names were used in the Cloudflare Worker version — should they be preserved for backwards compatibility with existing Claude projects?
- [ ] Should hive inspection photos be supported in the future, and if so, how are they stored?

---

## Acceptance Criteria

- [x] The Fastify-based hive-manager module exists in `packages/mcp-server/src/`.
- [x] DB schema for hive data is defined in `packages/shared/src/db/schema`.
- [ ] The sub-server is registered and reachable at `/api/hive-manager/mcp`.
- [ ] A Claude client authenticated with a valid OAuth token can call all hive tools and receive correct responses.
- [ ] An unauthenticated request to any hive tool returns a 401 error.
- [ ] Unit tests cover the core tool handlers.
