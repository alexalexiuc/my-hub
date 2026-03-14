# Feature: Calorie Tracker MCP

| Field    | Value                             |
| -------- | --------------------------------- |
| Status   | implemented                       |
| Priority | high                              |
| File     | `mcps/feature-calorie-tracker.md` |

---

## Summary

The Calorie Tracker MCP server lets an AI client log meals, retrieve nutritional
summaries, and manage the user's dietary profile on behalf of the authenticated user.
Implemented as a Fastify module backed by PostgreSQL on the self-hosted platform.

---

## Functional Requirements

| ID    | Requirement                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The server must expose a tool to log a meal (name, calories, macros, timestamp).                                                        |
| FR-02 | The server must expose a tool to retrieve a daily nutritional summary (total calories, macros, meal list) for a given date.             |
| FR-03 | The server must expose a tool to retrieve a weekly nutritional summary.                                                                 |
| FR-04 | The server must expose a tool to read and update the user's dietary profile (daily calorie goal, macros targets, activity level, etc.). |
| FR-05 | The server must expose a tool to delete a previously logged meal by ID.                                                                 |
| FR-06 | The server must expose a tool to get remaining calories for the day (goal minus logged).                                                |
| FR-07 | All tools must be scoped to the authenticated user.                                                                                     |
| FR-08 | The server must be reachable at `POST /mcp/calories` of the shared MCP Fastify app; userId is resolved from the Bearer token.           |

---

## Technical Requirements

| ID    | Requirement                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server/src/calories/` — `server.ts` wires tools; `tools/` contains profile, meals, summary handlers. |
| TR-02 | DB schema (`calorie_profiles`, `meal_logs`) is in `packages/shared/src/db/schema` using Drizzle ORM with `real()` columns for all decimals. |
| TR-03 | Access is protected by OAuth 2.1 PKCE; `mcpAuthHandler` validates the Bearer token and attaches `userId` to the request.                    |
| TR-04 | All DB queries go through `packages/shared/src/services/calories/` — no raw Drizzle in mcp-server.                                          |
| TR-05 | MCP transport uses `WebStandardStreamableHTTPServerTransport` in stateless mode (new server instance per POST).                             |

---

## Open Questions

- [ ] Should historical meal data older than N days be archived or kept fully queryable?
- [ ] Is barcode/food-database integration (e.g. Open Food Facts) in scope for a future iteration?

---

## Acceptance Criteria

- [x] All calorie-tracker MCP tools are available on the Fastify-based server (`log_meal`, `get_meals`, `delete_meal`, `get_daily_summary`, `get_weekly_summary`, `get_remaining`, `get_profile`, `setup_profile`).
- [x] A Claude client authenticated with a valid OAuth token can log a meal, retrieve the daily summary, and delete the meal.
- [x] An unauthenticated request returns 401.
- [ ] Data previously in Google Sheets is migrated to PostgreSQL (one-time migration script not yet written).
- [ ] Unit tests cover the core tool handlers.
