# Feature: OAuth Client Management

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | implemented                    |
| Priority | high                           |
| File     | `hub/feature-oauth-clients.md` |

---

## Summary

The OAuth Clients section of the Hub admin panel lets the owner create and revoke OAuth
2.0 credentials for MCP clients (e.g. Claude Desktop, Claude.ai). Without a valid OAuth
client, an AI client cannot authenticate against any MCP server. This is a prerequisite
for using any MCP tool on the platform.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | An admin user must be able to create a new OAuth client by specifying a display name and optionally a description.                                                         |
| FR-02 | On creation, the system must generate and display a `client_id` and `client_secret`. The secret must be shown only once and never retrievable again after initial display. |
| FR-03 | The admin must be able to list all existing OAuth clients with their display name, `client_id`, creation date, and last-used date.                                         |
| FR-04 | The admin must be able to revoke (delete) an OAuth client. Revocation must immediately invalidate all active sessions issued to that client.                               |
| FR-05 | Revoked clients must not appear in the active clients list, but their history may be retained for audit purposes.                                                          |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | OAuth 2.1 with PKCE (S256) is implemented in `packages/mcp-server/src/routes/oauth.ts`.                                                           |
| TR-02 | `clientSecret` is a single UUID (128-bit). It is hashed with scrypt before storage; the plaintext is shown once and never persisted.              |
| TR-03 | `clientId` uses the prefix `hub_` followed by 8 hex chars for readability (e.g. `hub_3f9a1b2c`).                                                  |
| TR-04 | `tokenSigningSecret` is 3 concatenated UUIDs with dashes stripped (288-bit entropy), distinct from `clientSecret` in length and purpose.          |
| TR-05 | The `oauth_clients` table is defined in `packages/shared/src/db/schema` and all queries go through `packages/shared/src/services/oauth-clients/`. |
| TR-06 | The Hub panel lives in `packages/hub` (Next.js App Router). It communicates with the backend via Server Actions or API routes.                    |
| TR-07 | Only authenticated users can access OAuth client management pages.                                                                                |
| TR-08 | On first OAuth completion, `ensureAllMcpServers(userId)` provisions a row per MCP server for the user (idempotent via `onConflictDoNothing`).     |

---

## Open Questions

- [ ] Should OAuth clients be per-user (multi-user future) or global to the platform (single-user for now)?
- [ ] Should there be a concept of scopes per client (e.g. read-only vs read-write), or are all clients granted full access?
- [ ] What is the token expiry policy — should refresh tokens be supported?

---

## Acceptance Criteria

- [x] A user can complete the OAuth 2.1 PKCE flow and receive a signed Bearer token.
- [x] The Bearer token is validated by `mcpAuthHandler` using the client's `tokenSigningSecret`.
- [x] After the flow, MCP server rows exist for the user (calories, todo, hive, products).
- [x] The client secret is not visible in the database or API responses after initial creation.
- [x] The Hub UI lists active OAuth clients and allows revocation (implemented in `/mcp-control` page — "Connections" section).
- [x] OAuth clients can be enabled/disabled (toggled) without full revocation.
- [ ] After revocation (delete), the previously issued token is rejected by the MCP server with a 401.
