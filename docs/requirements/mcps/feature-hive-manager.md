# Feature: Hive Manager MCP

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | implemented                    |
| Priority | high                           |
| File     | `mcps/feature-hive-manager.md` |

---

## Summary

The Hive Manager MCP server exposes beekeeping data to AI clients. It lets a user (via
Claude or another AI) log and query hive inspections, manage hive profiles, track todos,
and record hive relocations. The current implementation runs on Cloudflare Workers backed
by Google Sheets; the target is a Fastify app backed by PostgreSQL on the self-hosted
platform.

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
| TR-03 | Access is protected by OAuth 2.0; the existing OAuth implementation from the Cloudflare Worker must be adapted and reused.                    |
| TR-04 | A one-time migration script must transfer existing data from Google Sheets to PostgreSQL before cutover.                                      |
| TR-05 | The Cloudflare Worker implementation remains running until the new platform is validated in staging.                                          |
| TR-06 | MCP transport must support both SSE and Streamable HTTP as offered by the MCP SDK.                                                            |

---

## Open Questions

- [ ] Which MCP tool names were used in the Cloudflare Worker version — should they be preserved for backwards compatibility with existing Claude projects?
- [ ] Should hive inspection photos be supported in the future, and if so, how are they stored?

---

## Acceptance Criteria

- [ ] All existing hive-manager MCP tools are available on the new Fastify-based server and return the same data shape.
- [ ] Data previously in Google Sheets is accessible via the new server after running the migration script.
- [ ] A Claude client authenticated with a valid OAuth token can call all hive tools and receive correct responses.
- [ ] An unauthenticated request to any hive tool returns a 401 error.
- [ ] Unit tests cover the core tool handlers.
