---
name: vacation-domain
description: |
  Domain rules for the vacation planner — load before changing packages/shared/src/utils/vacation.ts,
  holidays-md.ts, packages/shared/src/services/vacation, packages/hub/src/app/vacation, vacation API routes or
  packages/mcp-server/src/vacation. Covers the Moldovan leave-pay engine, rule sets, tax regimes, salaries,
  holidays, demo mode and setup validation.
metadata:
  scope: monorepo
  stage: implementation
---

# Vacation domain

Exports: `pnpm inventory packages/shared/src/services/vacation --docs`; engine in `packages/shared/src/utils/vacation.ts`.
Spec: `docs/requirements/mcps/feature-vacation-planner.md` (the reference module for `add-feature-module`).

## Engine (pure, `utils/vacation.ts`)

- Moldovan HG 426 method, driven by rule sets. `createVacationModel(input)` exposes `.rateFor(date)`,
  `.calendar(from, to)`, `.evaluateSpan(start, end)`, `.balanceOn(date)`, `.findBestWindows(opts)`, `.warnings()`.
- Rate for a leave starting in a month: earnings over days actually worked (leave days subtracted), scaled for
  `calendar_day` rule sets; a base raise inside the window restarts it; no work in the window falls back to the
  latest worked months within 12. The span's rate is fixed by its **start** month; pay forgone uses each day's
  month.
- Balance accrues daily (`entitlement / days-in-year`); leave is charged oldest rule-set bucket first.
- Days: `classifyVacationDay` — an art. 111 holiday stays a holiday on a weekend; Government transfers apply.
  `moldovaPublicHolidays(year)` derives the 13 national days (incl. Orthodox Easter); hram days and transfers are
  data, not derivable.
- Draft rule sets (e.g. the 2027 reform) never apply before their `validFrom`.

## Data and setup

- `loadVacationModel(userId, { includeDraftRules, includePlanned })` narrows rule sets to the profile's
  country/region, tax regimes by date across employers (current employer wins on overlap), holidays to national +
  locality (regional row wins). Throws without a profile unless `allowDemo`.
- Demo mode: `buildVacationDemo(today)` — Hub routes opt in (`allowDemo`), MCP never does; results carry
  `demo: true`.
- Writes: `applyVacationSetup` is one validated transaction (rejects overlapping rule sets per
  country+region+status and tax regimes per employer before writing; a `manual` holiday is never overwritten by
  `research`). `applyLeaveChanges` rejects overlapping leave. Errors are `VacationValidationError`
  (`UserInputError`).
- Salaries are keyed by the month earned (stored as the 1st). Months without a row: latest earlier projected row,
  then `profile.baseSalaryMdl`, then carry the latest actual forward with a warning.

## UI and tests

- Hub: `packages/hub/src/app/vacation/` (calendar grid `VacationMonthGrid`/`VacationDayCell`, `vacation.utils.ts`).
  Day cells colour the amount (green gain, red loss), not the fill.
- Specs: `packages/e2e/tests/vacation.spec.ts` — date-sensitive (it once broke on Sundays and on "Balance cost"
  wording); MCP: `packages/mcp-server/e2e/vacation.e2e.ts` (template for new domains).
