# Feature: OAuth Client Management

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Status   | draft                                  |
| Priority | high                                   |
| File     | `hub/feature-oauth-clients.md`         |

---

## Summary

The OAuth Clients section of the Hub admin panel lets the owner create and revoke OAuth
2.0 credentials for MCP clients (e.g. Claude Desktop, Claude.ai). Without a valid OAuth
client, an AI client cannot authenticate against any MCP server. This is a prerequisite
for using any MCP tool on the platform.

---

## Functional Requirements

| ID    | Requirement |
| ----- | ----------- |
| FR-01 | An admin user must be able to create a new OAuth client by specifying a display name and optionally a description. |
| FR-02 | On creation, the system must generate and display a `client_id` and `client_secret`. The secret must be shown only once and never retrievable again after initial display. |
| FR-03 | The admin must be able to list all existing OAuth clients with their display name, `client_id`, creation date, and last-used date. |
| FR-04 | The admin must be able to revoke (delete) an OAuth client. Revocation must immediately invalidate all active sessions issued to that client. |
| FR-05 | Revoked clients must not appear in the active clients list, but their history may be retained for audit purposes. |

---

## Technical Requirements

| ID    | Requirement |
| ----- | ----------- |
| TR-01 | The OAuth 2.0 implementation is adapted from the existing Cloudflare Worker `src/http/` auth code. |
| TR-02 | Client secrets must be stored as a bcrypt hash; the plaintext is never persisted. |
| TR-03 | The OAuth clients table is defined in `packages/shared/src/db/schema` (Drizzle ORM, PostgreSQL). |
| TR-04 | The admin panel page lives in `packages/admin` and communicates with the backend via a Next.js Server Action or API route. |
| TR-05 | Only authenticated admin users (via NextAuth.js or custom JWT session) can access this page. |
| TR-06 | All writes (create, revoke) must be logged for audit traceability. |

---

## Open Questions

- [ ] Should OAuth clients be per-user (multi-user future) or global to the platform (single-user for now)?
- [ ] Should there be a concept of scopes per client (e.g. read-only vs read-write), or are all clients granted full access?
- [ ] What is the token expiry policy — should refresh tokens be supported?

---

## Acceptance Criteria

- [ ] An admin can create an OAuth client, copy the secret, and successfully authenticate a Claude MCP client with it.
- [ ] After revocation, the previously issued token is rejected by the MCP server with a 401.
- [ ] The client secret is not visible in the database or API responses after initial creation.
- [ ] The clients list correctly reflects active and revoked state.
- [ ] Accessing the OAuth clients page while unauthenticated redirects to the login page.
