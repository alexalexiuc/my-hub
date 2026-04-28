# Feature: Shared Services Layer

| Field    | Value                                       |
| -------- | ------------------------------------------- |
| Status   | implemented                                 |
| Priority | high                                        |
| File     | `platform/feature-shared-services-layer.md` |

---

## Summary

All database access lives in `packages/shared/src/services/` organised by domain. Both
`mcp-server` and `hub` import typed service functions from `@my-hub/shared/services`
instead of writing raw Drizzle queries per package. This eliminates duplication and
ensures schema changes propagate in one place.

---

## Services structure

```
packages/shared/src/services/
  index.ts              ← barrel: re-exports all domain folders
  calories/
    profile.ts          ← getCalorieProfile, upsertCalorieProfile, deleteCalorieProfile
    meals.ts            ← logMeal, getMeals, getMealsForDate, getMealsForDateRange, deleteMeal, deleteAllUserMeals
    index.ts
  measurements/
    types.ts            ← getMeasurementTypes, getMeasurementTypeByKey, getMeasurementTypeById
    measurements.ts     ← logMeasurement, getMeasurements, getLatestMeasurementsPerType, deleteAllUserMeasurements, deleteMeasurement
    index.ts
  users/
    users.ts            ← findUserByEmail, findOrCreateUser, updateUserName
    index.ts
  oauth-clients/
    oauth-clients.ts    ← findOAuthClient, createOAuthClient, bindOAuthClientToUser, verifyClientSecret
    index.ts
  mcp-servers/
    mcp-servers.ts      ← ensureAllMcpServers
    index.ts
  logs/
    index.ts            ← putLog, getLogs, deleteOldLogs
```

Import pattern for consumers:

```typescript
import { getCalorieProfile, getMeasurementTypes, findOrCreateUser } from '@my-hub/shared/services';
```

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | All DB queries must be accessible from both `mcp-server` and `hub` without duplication.                                                                       |
| FR-02 | Each domain exposes typed service functions; callers never import `db` or `drizzle-orm` directly.                                                             |
| FR-03 | The `calories` domain exposes profile and meal operations: get, upsert, delete profile; log, get, delete (single + all) meals.                                |
| FR-04 | The `users` domain exposes find by email, find-or-create (used by Hub on first login), and update-name operations.                                            |
| FR-05 | The `oauth-clients` domain exposes find, create, user-binding, and secret-verification operations.                                                            |
| FR-06 | The `mcp-servers` domain exposes `ensureAllMcpServers(userId)` which idempotently provisions server rows.                                                     |
| FR-07 | The `measurements` domain exposes: type lookups, log measurement, get measurements (with filters), get latest per type, delete single, delete all for a user. |
| FR-08 | Finance currency conversion must resolve rates even when `finance_currency_rates` is empty by fetching and persisting the missing date-based pair.            |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Service files import `db` from `"../../db/client"` only. No other package may import `db` directly.                                                                                                                                 |
| TR-02 | All decimal/float columns in the schema use Drizzle `real()` (PostgreSQL `REAL`). This avoids string↔number round-trips — values are native JS `number`.                                                                            |
| TR-03 | `packages/shared/src/utils/index.ts` exports `omitNullish<T>(obj)` — strips `null`/`undefined` properties at runtime. Return type is `Partial<{ [K in keyof T]: NonNullable<T[K]> }>` which satisfies `exactOptionalPropertyTypes`. |
| TR-04 | `packages/shared/package.json` exports both `"./services"` and `"./utils"` entry points (plus `"./types"`, `"./schema"`, `"./db"`, `"./auth"`).                                                                                     |
| TR-05 | Running `grep -r "db\.(insert\|update\|query\|select\|delete)" packages/mcp-server/src` must return zero matches.                                                                                                                   |
| TR-06 | `MeasurementWithType` (returned by `getMeasurements` and `getLatestMeasurementsPerType`) is an exported type that extends `BodyMeasurement` with `typeKey`, `typeLabel`, and `typeUnit` fields populated via a JOIN.                |
| TR-07 | Finance exchange-rate lookup uses in-memory promise caching keyed by `(from, to, date)` to avoid repeated DB reads for immutable historical rates.                                                                                  |

---

## Acceptance Criteria

- [x] `pnpm --filter @my-hub/shared typecheck` passes clean.
- [x] `pnpm --filter @my-hub/mcp-server typecheck` passes clean.
- [x] No raw Drizzle calls remain in `packages/mcp-server/src`.
- [x] `omitNullish` replaces all per-property `if (val != null)` guards in calorie tool handlers.
- [x] `measurements` domain is importable from `@my-hub/shared/services` and used by both `mcp-server` and `hub`.
- [x] `findOrCreateUser` creates a DB user row on first Hub login via Google OAuth.
- [x] Missing finance currency-rate rows are fetched from the external exchange API and saved for reuse.
