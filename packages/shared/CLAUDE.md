# shared package — Agent Guidelines

## Utility inventory — `src/utils/`

| File                  | What's inside                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dates.ts`            | Date/time helpers: formatting (YYYY-MM-DD, UTC, locale), timezone resolution (offset + IANA), current/relative date strings (`currentDateString`, `dateStringDaysAgo`, `localDateString`), ISO week arithmetic, month/week label formatters, addDays/addHours/addMinutes, calendarDays, formatDayHeading, fmtDuration, formatSegmentTime; calendar utils (getMonthStart/End, startOfWeekMonday, isSameDay, toDate, startOfDay); HTML input formatters (toDateInputValue, toDateTimeLocalValue); timezone display (getTimezoneNamePart, normalizeOffset, getTimezoneBadge, getFullDateTooltip); `getCurrentWeekDays` (ISO week Mon–Sun with YYYY-MM-DD + short labels) |
| `objects.ts`          | Object helpers: `omitUndefined` (strips `undefined` props), `omitNullish` (strips `null` and `undefined` props), `trimOrNull(val)` (trims string; returns `null` for empty, `undefined` unchanged — pair with `omitUndefined`), `getEnvVar(key, default?)` (reads `process.env[key]`, throws if missing and no default provided — use this instead of `process.env` directly)                                                                                                                                                                                                                                                                                         |
| `coordinates.ts`      | Geographic coordinate utilities: `validateCoords` (Zod, range checks, both-or-neither), `isFiniteCoordinate`, `hasValidLatLng`, `parseCoordinatePair` ("lat,lng" string), `parseGeoUri` (geo URI), `containsPlusCode` (Plus Code detection)                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `withBackoffRetry.ts` | Promise retry with exponential backoff: `withBackoffRetry(fn, { retries, delay, shouldRetry })`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `calories.ts`         | TDEE/calorie-target calculation: `calculateBMR` (Mifflin-St Jeor), `calculateCalorieTargets` (applies goal offset, floors, caps), `ActivityLevelMultipliers`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `travel.ts`           | Trip domain helpers: `deriveTripStatus` (computes Planned/Active/Completed/Cancelled), `isTransportBookingType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `finances.ts`         | Finance domain helpers: `getCurrencySymbol(currency)` — maps currency code to display symbol (USD→$, GBP→£, EUR→€), falls back to the code itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `logger.ts`           | Minimal logger with ISO timestamps: `logger.info/warn/error` — wraps `console.log/warn/error` with an ISO 8601 prefix. Use in worker and server startup code where no framework logger is available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

> Before writing any utility or component, check the tables above. If the function has general purpose (string, number, date, array, etc.), it belongs here even if only one place uses it currently.

## Service inventory — `src/services/travel/`

| File                    | What's inside                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trips.ts`              | Trip CRUD + access: createTrip, getTrips, getAccessibleTrips, getTripById/Accessible, updateTrip, deleteTrip, getNextTrip, getTripBookingRanges, verifyTripOwnership/Access         |
| `bookings.ts`           | Booking CRUD + filters: addTripBooking, getTripBookings, getUpcomingTripBookings, getTripBookingById, updateTripBooking, deleteTripBooking — coordinate validation on insert/update |
| `checklist.ts`          | Checklist item CRUD: addChecklistItem, getChecklistItems, updateChecklistItem, toggleChecklistItem, deleteChecklistItem                                                             |
| `companions.ts`         | Travel companion CRUD: addTripCompanion, getTripCompanions, updateTripCompanion, deleteTripCompanion                                                                                |
| `days.ts`               | Trip day notes: upsertTripDay, getTripDays, deleteTripDay                                                                                                                           |
| `documents.ts`          | Document records CRUD: addTripDocument, getTripDocuments, getTripDocumentById, updateTripDocument, deleteTripDocument                                                               |
| `places.ts`             | Points of interest CRUD: addTripPlace, getTripPlaces (filterable by visited/priority), updateTripPlace, deleteTripPlace                                                             |
| `shares.ts`             | Trip sharing: listTripShares, createTripShare, deleteTripShare, deleteAllUserTripShares                                                                                             |
| `semantic.ts`           | Aggregated read queries: getTripOverview, getTripBrief, getTripTimeline, getUpcomingBookings, suggestChecklistTemplate                                                              |
| `flightData.ts`         | Flight data polling: upsertFlightData, updateFlightData, getFlightDataDueForFetch, computeNextFetchAt, backOffFlightData, setFlightDataAutoUpdate, linkBookingToFlightData          |
| `flightDataApi.ts`      | AeroDataBox API client: fetchFlightFromApi — RapidAPI, 600 req/month, requires RAPIDAPI_KEY                                                                                         |
| `flightDataApiTypes.ts` | AeroDataBox response types: AeroDataBoxFlight, FlightStatus, CodeshareStatus, FlightAirportMovementQualityEnum                                                                      |

## Service inventory — `src/services/finances/`

| File               | What's inside                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budgets.ts`       | Budget CRUD + access: createBudget, getUserBudgets, getBudgetById, updateBudget, deleteBudget, deleteAllUserFinanceBudgets, verifyBudgetAccess — membership-based access via financeBudgetMembers                                                                                                                                                                                                                                        |
| `accounts.ts`      | Account CRUD: createAccount, getAccounts (opts: includeArchived), getAccountById, updateAccount, deleteAccount; getNetWorthHistory(userId, budgetId, limit?) — last N monthly snapshots oldest-first, returns NetWorthSnapshot[]                                                                                                                                                                                                         |
| `categories.ts`    | Group + category CRUD: createGroup/getGroups/updateGroup/deleteGroup, createCategory/getCategories/getCategoryById/updateCategory/deleteCategory                                                                                                                                                                                                                                                                                         |
| `transactions.ts`  | Transaction CRUD: addTransaction, getTransactions (opts: accountId/categoryId/payeeId/type/fromDate/toDate/includeCorrections/search/limit/offset), countTransactions (same opts), checkDuplicateTransaction (opts: accountId/date/amount/payeeId), getTransactionById, updateTransaction, deleteTransaction — all mutating ops update payee stats; Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts, DuplicateCheckOpts |
| `payees.ts`        | Payee CRUD + stats: upsertPayee (case-insensitive via normalizedName), getPayees (returns Payee[] with description ranked by user usage), deletePayee, incrementPayeeStats, decrementPayeeStats; Type: Payee                                                                                                                                                                                                                             |
| `exchangeRates.ts` | Exchange-rate orchestration: getExchangeRate (in-memory promise cache + DB exact hit + external API fetch + DB persist + recent-row fallback)                                                                                                                                                                                                                                                                                            |
| `reporting.ts`     | Read-only finance reporting aggregations: getBudgetProgress, getCashflowSummary, getSpendingByPayee, getSpendingAggregates, getNetWorthSummary                                                                                                                                                                                                                                                                                           |

## Keeping the inventory current

When you **modify or add** any file under `src/utils/` or `src/services/`:

1. Update (or add) the file-level JSDoc inventory comment at the top of the file — list every named export with a one-liner.
2. Update the relevant table in this file to reflect the change.

> **Scope:** File-level JSDoc inventory comments apply only to `packages/shared/` (utils + services) and `packages/hub/src/components/`. Do **not** add them to feature folders (`src/app/…`) in hub or mcp-server.

## Build dependency

`packages/mcp-server` and `packages/hub` both compile against `packages/shared/dist/`, **not** the TypeScript source directly.

After editing anything in `packages/shared/src/`, run:

```
cd packages/shared && npm run build
```

before type-checking or running dependent packages. Without this step, downstream packages will see stale type definitions and report false errors.

## Extension points

### `trip_bookings.details` (JSONB)

This column is the designated extension point for booking-type-specific metadata. Do not add new columns to `trip_bookings` for type-specific fields — put them in `details` instead.

Conventions:

- Define a TypeScript interface in `src/types/index.ts` for each details shape.
- Always add a `readonly kind: '<type>'` discriminator field so consumers can distinguish shapes at runtime without checking `booking_type`.
- Current shapes: `FlightDetails` (`kind: 'flight'`), `TransportDetails` (`kind: 'transport'`).

### `TripBookingTypes` constant

Lives in `src/constants/travel.ts`. When adding a new booking type, also update `BookingTypeIcon.tsx` in hub and any `switch`/`case` blocks in `coming-next-utils.ts` and `BookingsSection.tsx`.
