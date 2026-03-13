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
It currently runs on Cloudflare Workers backed by Google Sheets; the target is a
Fastify module backed by PostgreSQL on the self-hosted platform.

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
| FR-08 | The server must be reachable at the `/mcp/calories/:userId` route of the shared MCP Fastify app.                                        |

---

## Technical Requirements

| ID    | Requirement                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Implementation lives in `packages/mcp-server` as a self-contained module (e.g. `src/servers/calories/`).                  |
| TR-02 | The DB schema (meals, user profiles) must be defined in `packages/shared/src/db/schema` using Drizzle ORM.                |
| TR-03 | Access is protected by OAuth 2.0; the shared OAuth middleware from the Cloudflare Worker must be reused.                  |
| TR-04 | A one-time migration script must transfer existing meal and profile data from Google Sheets to PostgreSQL before cutover. |
| TR-05 | The Cloudflare Worker implementation remains running until the new platform is validated in staging.                      |
| TR-06 | MCP transport must support both SSE and Streamable HTTP as offered by the MCP SDK.                                        |

---

## Open Questions

- [ ] Should historical meal data older than N days be archived or kept fully queryable?
- [ ] Is barcode/food-database integration (e.g. Open Food Facts) in scope for a future iteration?

---

## Acceptance Criteria

- [ ] All calorie-tracker MCP tools are available on the new Fastify-based server and return the same data shape as the Cloudflare Worker version.
- [ ] Data previously in Google Sheets is accessible via the new server after running the migration script.
- [ ] A Claude client authenticated with a valid OAuth token can log a meal, retrieve the daily summary, and delete the meal.
- [ ] An unauthenticated request returns a 401 error.
- [ ] Unit tests cover the core tool handlers.
