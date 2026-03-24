# Feature: API Request Logging Infrastructure

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Status   | implemented                               |
| Priority | high                                      |
| File     | `platform/feature-api-request-logging.md` |

---

## Summary

Introduce a shared PostgreSQL-backed logging table for structured API request/response events
from both Hub and MCP services. The data supports debugging, ops visibility, and dashboard
analytics while enforcing bounded retention.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The platform must persist structured API log events in PostgreSQL with service, server (when applicable), request metadata, response metadata, and optional error text. |
| FR-02 | The log model must support both app-level service sources (`hub`, `mcp-service`).                                                                                       |
| FR-03 | Logs older than the configured retention window (14-30 days, default 30 days) must be removable via scheduled cleanup.                                                  |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | PostgreSQL extensions `pgcrypto`, `pg_trgm`, and `pg_stat_statements` must be enabled via migration SQL.                                                                                                            |
| TR-02 | The table `api_request_logs` must include columns: `id`, `service`, `server`, `created_at`, `method`, `path`, `status_code`, `duration_ms`, `ip`, `user_id`, `client_id`, `request_body`, `response_body`, `error`. |
| TR-03 | Indexes must exist on `created_at`, `path`, `user_id`, `status_code`, `service`, and `server` for common dashboard and filter queries.                                                                              |
| TR-04 | A trigram GIN index on `error` should be present to accelerate fuzzy search across failure messages.                                                                                                                |
| TR-05 | A typed Drizzle schema definition for `api_request_logs` must be available from `packages/shared/src/db/schema` and exported through shared schema/types barrels.                                                   |
| TR-06 | Before request payloads are printed or persisted, sensitive headers (`authorization`, `cookie`, `set-cookie`, API-key style headers) must be redacted.                                                              |
| TR-07 | Before request/response payloads are printed or persisted, sensitive OAuth fields (`client_name`, `client_secret`, `code`, `code_challenge`, `code_verifier`, `access_token`, `refresh_token`) must be redacted.    |

---

## Open Questions

- [ ] Should service values be constrained with a DB-level check (`hub`/`mcp`) in a follow-up migration?
- [ ] Should retention defaults be parameterized by environment and documented as an ops runbook variable?

## Notes

- `service` identifies the parent app (`hub`, `mcp-service`).
- `server` identifies the MCP sub-server (`calories`, `todo`, `apiary`, `products`) and is nullable for non-MCP routes.

---

## Acceptance Criteria

- [ ] Migration SQL creates required PostgreSQL extensions when missing.
- [ ] Migration SQL creates the `api_request_logs` table and required indexes.
- [ ] Drizzle schema exports allow typed reads/inserts for API request logs from shared package consumers.
- [x] Logger redacts sensitive request headers before writing `request_body` or printing request payloads.
- [x] Logger redacts sensitive OAuth request/response fields before writing payloads or printing payloads.
- [ ] Documentation includes retention policy and cleanup query guidance.
