---
name: calories-domain
description: |
  Domain rules for the calories feature — load before changing packages/shared/src/services/calories,
  measurements, calories utils (targets, weight goal), packages/hub/src/app/calories, calories API routes,
  packages/mcp-server/src/calories, or the weekly/monthly calorie report emails. Covers targets, goal baselines,
  weight trend, weekly menus and logging.
metadata:
  scope: monorepo
  stage: implementation
---

# Calories domain

Exports: `pnpm inventory packages/shared/src/services/calories --docs` (and `packages/shared/src/utils` for the
maths). Spec: `docs/requirements/mcps/feature-calorie-tracker.md`.

## Single owners — reuse, never re-derive

- Targets: `profileToTargets` (profile + latest weight → targets), `dayCalorieTargets` / `dayTargetKcal` (one
  day's ceiling + floor incl. the gym-day bonus), `calculateCalorieTargets` (goal offset, floors, caps). Meal slot
  order: `mealOrder(gymTime)`.
- Goal direction/rate: `goalDirection(goalType)` (from the type, not the rate), `signedWeeklyRateKg`,
  `isTowardGoal`.
- Weight maths (`utils/weight-goal.ts`): compare the **EMA trend** (`buildWeightTrend`, decay per day elapsed,
  same-day readings averaged) against the projection — never single weigh-ins. `resolveGoalAnchor` →
  `projectedWeightOn`, `trendRateKgPerWeek`, `goalJourney`, `projectGoalDate`.

## Profile and goal baseline

`upsertCalorieProfile` owns `goalStartDate` / `goalStartWeightKg`: it stamps them (today + latest `weight`
measurement) when a goal is first set, when `goalType` / `goalWeeklyRateKg` change, or when a goal has none — and
never otherwise, so projections stay cumulative. An explicit baseline in the update always wins.

## Weekly menu and logging

- `logMenuMeal` writes the journal entry and the day-log marker in one transaction; `unlogMenuMeal` undoes both.
  There is deliberately no "mark as logged" helper — a marker without its journal entry is the desync this
  prevents.
- `upsertMenuMeal` overwrites a slot and clears its day-log. One meal per slot: `hasDuplicateMealSlot`.
- Shopping list: `replaceShoppingListItems` is the AI-authored whole-list write path; `addShoppingListItems`
  trims and dedupes case-insensitively.
- Quick re-log: `getRecentMealSuggestions` (newest meal per distinct description).

## MCP, UI, tests

- MCP: `packages/mcp-server/src/calories/` — `models/` (`buildDailySummary`, profile snapshot) is shared by tools
  and resources; resources `calories://profile|today|history-7days|history-30days`. Tools exist for profile reads
  too, since some clients ignore resources.
- Reports: `report-data.ts` feeds the weekly/monthly email templates (see `worker-email-reports`).
- Hub: `packages/hub/src/app/calories/` (Today, calendar, progress, weekly menu, settings).
- Specs: `packages/e2e/tests/calories-*.spec.ts`; MCP: `packages/mcp-server/e2e/calories-*.e2e.ts` (the
  `calories-profile` suite has timed out on staging before — see `ci-triage`).
