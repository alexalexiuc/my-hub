# Feature: Vacation Planner

| Field    | Value                              |
| -------- | ---------------------------------- |
| Status   | implemented                        |
| Priority | medium                             |
| File     | `mcps/feature-vacation-planner.md` |

---

## Summary

Shows, for each calendar day, how pay changes if that day is taken as annual leave, and finds the best leave
windows via MCP. Moldovan leave pay is not "same money, day off": it is an average over the three months before
the leave, paid per calendar day, and weekends inside a leave span consume balance but are paid. The planner
makes that visible Booking-style (a colour-coded month grid) and answers questions such as "best time to take 7
days in May–July?".

The leave law is data (versioned rule sets), not code branches, so the draft 2027 reform and future changes are
new rows.

---

## Legal basis (verified 2026-09-27)

| Rule                                                                                                                                                                                                                                                                    | Source                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Annual leave is at least 28 **calendar** days; art. 111 non-working holidays falling inside it are not counted.                                                                                                                                                         | Labour Code art. 112                          |
| Non-working holidays: 1 Jan, 7–8 Jan, 8 Mar, Orthodox Easter Sunday + Monday, Blajini (Monday a week after Easter), 1 May, 9 May, 1 Jun, 27 Aug, 31 Aug, 25 Dec, plus the local church **hram** day declared by the local council. A holiday on a weekend is not moved. | Labour Code art. 111                          |
| Leave pay is at least the average monthly salary for the period ("nu poate fi mai mică decât salariul mediu lunar"). The HG 426 method below is how that is computed; there is no separate floor calculation.                                                           | Labour Code art. 117(1)                       |
| Settlement period: the 3 calendar months before the month the leave starts.                                                                                                                                                                                             | HG 426/2004                                   |
| Average per working day = earnings of the 3 months ÷ days actually worked.                                                                                                                                                                                              | HG 426/2004                                   |
| Average per calendar day = working-day average × working days in the period ÷ (calendar days in the period − art. 111 holidays). Leave pay = calendar-day average × leave days.                                                                                         | HG 426/2004                                   |
| A month with leave or unpaid leave stays in the period; only those days (and their pay) are removed from days worked / earnings.                                                                                                                                        | HG 426/2004                                   |
| No earnings in the 3 months: use the latest 3 months with work within the previous 12. Shorter employment: the months actually worked.                                                                                                                                  | HG 426/2004                                   |
| A salary increase: only the post-increase period is used.                                                                                                                                                                                                               | HG 426/2004 (as summarised by contabilsef.md) |
| Standard payroll: AOAM 9 % of gross; income tax 12 % on (gross − AOAM − personal exemption). Marginal net share = 0.91 × 0.88 = 0.8008. IT Park: single tax paid by the employer, no employee withholding.                                                              | Fiscal Code 2026                              |
| 2027 reform: 22 **working** days instead of 28 calendar days from 1 Jan 2027; balances accrued before stay valid. **Draft under public consultation**, the pay formula is not published.                                                                                | Ministry of Labour, June 2026                 |

Worked check from a published example (delucru.md): 31 000 MDL over 3 months, 60 working days, 90 calendar days
→ 31 000 / 60 × 60 / 90 = 344.44 per calendar day → 28 days = 9 644.44 MDL. This is asserted in the engine tests.

---

## Calculation model

Per leave starting in month **M**, under the rule set charged for the day (see buckets):

```
window         = the avgWindowMonths full months before M
                 − months before the first salary row
                 − months before a base raise inside the window (raiseResetsWindow)
                 → latest months with work within 12 if nobody worked in the window
earnings(m)    = base(m) × workedDays(m) / workingDays(m) + extra(m)
workingDayRate = Σ earnings / Σ workedDays
calendarDayRate= workingDayRate × Σ workingDays / Σ (calendarDays − holidays)
rate           = calendarDayRate (rateBasis calendar_day) | workingDayRate (working_day)
```

Per day **D** inside a leave:

```
cost(D)     = calendar unit: 0 on an art. 111 holiday, else 1  |  working unit: 1 on a workday, else 0
amount(D)   = cost(D) × rate
baseline(D) = base(month(D)) / workingDays(month(D)) on a workday, else 0
delta(D)    = (amount(D) − baseline(D)) × (1 − medicalRate) × (1 − incomeTaxRate)
```

- A workday is Mon–Fri that is not a holiday or a Government-transferred day off, plus transferred working
  Saturdays. A transferred day off is an ordinary rest day, so it is charged and paid under calendar-day rules.
- Span totals fix the rate by the start month and compute the pay forgone by each day's own month.
- Per-day calendar values assume a leave starting in that day's month; window totals never sum independent days.
- A month with no salary row uses: the latest earlier row if that is a **projection** (a projection states the salary from then on); else the profile's gross `baseSalaryMdl` when set (from the first row on); else the latest actual row carried forward, with a warning. `extra` never carries.
- Tax regimes apply by their own dates across every employer, so past months keep the regime of the employer you had then; on overlap the profile's current employer wins.
- A rule set applies only between `validFrom` and `validTo`; a draft only when previewed. From a new rule set's start, balance saved under the previous one is spent first under its own unit and rate.
- Balance: opening snapshot on `openingBalanceDate`, then `annualEntitlementDays / daysInYear` per day under the
  rule set in force. Leave is charged to the oldest bucket with balance left (pre-2027 calendar days before 2027
  working days); a deficit rolls into the bucket in force.
- With no rule set covering a date, the latest rule set already started is extended (a law stays until
  replaced). A draft only takes part when a query asks for drafts, and then wins over an overlapping active set.

---

## Differences from the original design

| Original direction                                      | Implemented                                                                                                                                                | Why                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Single profile, no `user_id`                            | Every table is owned by `user_id`, one profile per user, `deleteAllUserVacationData` wired to delete-all / delete-data                                     | Repo rule for user-linked tables                                                                                   |
| Separate Postgres schema `vacation`                     | `vacation_*` tables in `public`                                                                                                                            | No other module uses `pgSchema`; the prefix keeps the one-schema convention                                        |
| DB exclusion constraints on `daterange`                 | Overlap validation in the service before a single transaction                                                                                              | Drizzle cannot express `EXCLUDE`; validating first also gives the precise error message the spec asked for         |
| `salary_months.components` JSONB                        | `baseMdl` + `extraMdl`                                                                                                                                     | The math needs exactly that split: the base carries forward and detects raises, extras count only in their month   |
| `leave_periods.rule_set_id`                             | Derived from dates and buckets                                                                                                                             | Stored ids go stale when rule sets change                                                                          |
| `rate_cache` + nightly job                              | Computed per request                                                                                                                                       | A rate is ~3 salary rows plus that window's holidays/leave; memoised within the request                            |
| Floor rule as a separate calculation                    | Not computed separately                                                                                                                                    | Art. 117(1) is the principle the HG 426 method implements                                                          |
| `vacation_leave`, `vacation_query` with a `mode` switch | `vacation_plan_leave`, `vacation_find_best_windows`, `vacation_estimate_leave_pay`, `vacation_get_calendar`, `vacation_get_balance`, `vacation_get_config` | Task-oriented tools with focused schemas (`mcp-task-tools`); span pricing is its own intent                        |
| `days` for best windows                                 | `leaveDays` (balance to spend) **or** `restDays` (continuous time off wanted)                                                                              | "7 days" was ambiguous, and `min_balance` only makes sense for a fixed rest length                                 |
| snake_case inputs                                       | camelCase                                                                                                                                                  | Repo convention                                                                                                    |
| Standard regime "net computed per month"                | Linear marginal rates stored on the regime row                                                                                                             | The personal exemption is a fixed monthly amount, so it cancels out of a delta while taxable income stays positive |

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Per-day view: net delta vs working, net leave pay, balance cost and markers (weekend, holiday, transferred day off/workday, leave taken/planned).                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| FR-02 | Span pricing: balance cost, net pay, net delta, rest days including adjacent weekends/holidays/leave, and the rate used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FR-03 | Best windows: ranked, non-overlapping spans in a range for `leaveDays` (max_money, max_rest) or `restDays` (min_balance, max_money); spans overlapping recorded leave are skipped.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FR-04 | Balance on any date, split per rule-set bucket, with accrual and (optionally) planned leave applied.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FR-05 | Rule sets are versioned by date, country and region; draft rule sets are opt-in per query.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| FR-06 | Tax regimes are time-boxed per employer; amounts are net where a regime applies and gross with a warning otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| FR-07 | Setup via one MCP call with an identical `{upsert, remove}` shape per section; the whole call is validated before anything is written.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| FR-08 | Holidays: national rows plus the profile locality's hram day; a manual row is never overwritten by researched data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| FR-09 | Every query returns data-quality warnings (carried-forward salaries, missing rule set or tax regime, raises around the window, negative balance, missing holiday years).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FR-10 | Hub `/vacation`: month grid coloured by delta magnitude, tap a day or drag a span for totals, draft-rules toggle, balance today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| FR-11 | Without a vacation profile, Hub `/vacation` shows a labelled demo calendar (sample salaries, leave and art. 111 holidays for the current and next two years) instead of an error. MCP tools keep returning the setup error so the assistant knows to run `vacation_setup`.                                                                                                                                                                                                                                                                                                                              |
| FR-12 | Hub `/vacation` is a themed feature scope (`vacation`, default `sky-deep`): it renders on the theme's tinted surfaces with an accent wash on the page background, and can be re-themed from Profile / Appearance.                                                                                                                                                                                                                                                                                                                                                                                       |
| FR-13 | Hub `/vacation` has a tab menu (sidebar on desktop, bottom nav on mobile): **Calendar** (the month grid, landing tab), **Vacations** (record, edit and delete leave), **Payments** (record, edit and delete monthly salaries) and **Profile** (edit the vacation profile; read-only view of rule sets, tax regimes, holiday coverage and setup warnings).                                                                                                                                                                                                                                               |
| FR-14 | Recorded leave is visible on every day cell (amounts are coloured green for a gain, red for a loss): taken days get a solid violet outline and an `OFF` badge, planned days a dashed blue outline and a `PLAN` badge, explained by a legend under the grid. Tapping a leave day shows that vacation (status, dates, notes) with a **Show whole vacation** action that prices the whole period. The **Vacations** list shows each period's net delta vs working (estimate, or actual when the pay received is recorded) and expands on tap to pay, balance cost, rest, salary forgone and the rate used. |
| FR-15 | Profile has an optional gross monthly **base salary** (`baseSalaryMdl`), used for months with no salary row instead of guessing from the latest payslip. The Profile tab shows every rule set and employer tax regime as a dated card (in force today / draft, unit, entitlement, pay basis, notes), salary and holiday coverage, and how to record an employer change. The calendar's draft toggle lists each draft rule set, what it changes and the date it would apply from.                                                                                                                        |

---

## Technical Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01  | Schema in `packages/shared/src/db/schema/vacation.ts`; enum-like values in `packages/shared/src/constants/vacation.ts`.                                                                                                                                                                                                                       |
| TR-02  | Pure engine in `packages/shared/src/utils/vacation.ts` (unit-tested against the 2026 MD calendar); DB access in `packages/shared/src/services/vacation/`.                                                                                                                                                                                     |
| TR-03  | MCP sub-server at `/api/vacation/mcp` (`McpServerNames.Vacation`); `VacationValidationError` extends the shared `UserInputError`, which MCP reports as a handled tool error and Hub routes answer with a 400.                                                                                                                                 |
| TR-04  | Hub API: `GET /api/vacation/calendar?month=`, `/span?startDate=&endDate=`, `/balance?date=` (all accept `includeDraftRules`).                                                                                                                                                                                                                 |
| TR-04b | Hub write API for the tabs: `GET /api/vacation/config`, `PUT /api/vacation/profile`, `POST /api/vacation/leave`, `DELETE /api/vacation/leave/:id`, `GET`/`PUT /api/vacation/salaries`, `DELETE /api/vacation/salaries/:month` — thin wrappers over `getVacationConfig`, `applyVacationSetup`, `applyLeaveChanges` and `listVacationSalaries`. |
| TR-04c | `GET /api/vacation/leave?includeDraftRules=` wraps `getVacationLeaveEstimates`: every leave period priced as one leave via `evaluateSpan` + `rateFor`; `estimate` is null when the averaging window has no salary.                                                                                                                            |
| TR-05  | Calendar and window searches are capped at 366 days; spans at 60 days. Dates must be real calendar dates and at most 20 years past the opening balance date (the balance is simulated day by day); leave can only be recorded once a profile exists.                                                                                          |

---

## Operations

- **Yearly holidays:** a claude.ai scheduled routine in December researches next year's art. 111 dates (Orthodox
  Easter moves), the locality's hram day and any Government day transfers, and writes them with `vacation_setup`.
  Transfers announced mid-year are added the same way. The worker is not involved (it cannot call Claude).

---

## Open Questions

- [ ] Which pay components Deel includes in the 3-month base (bonuses, allowances) — model them as `extraMdl` once known.
- [ ] Whether a raise **after** the window but before the leave adjusts the average (currently a warning only).
- [ ] How the 2027 reform pays a working day once enacted (currently assumed: working-day average), and its final wording.
- [ ] Whether Chișinău's hram day (14 Oct) is declared non-working each year by the municipal council.
- [ ] Annual bonuses: included in the month they are attributed to; HG 426 may require apportioning them.
- [ ] Sick leave and unpaid absence are not modelled separately from leave periods.

---

## Acceptance Criteria

- [x] Vacation schema, constants and migration added in shared.
- [x] Engine reproduces the HG 426 calendar-day average, including leave inside the window, bonuses, raises, carry-forward and short employment.
- [x] Weekends are paid and charged, art. 111 holidays neither, under calendar-day rules; working-day rules charge workdays only.
- [x] Pre-2027 balance is spent first under its own unit when the draft reform is included.
- [x] `vacation_setup` rejects overlapping rule sets / tax regimes and writes nothing on failure.
- [x] MCP sub-server with 7 task-oriented tools registered at `/api/vacation/mcp`.
- [x] Hub `/vacation` page with colour-coded grid, tap/drag span pricing and draft toggle (desktop and mobile).
- [x] Demo calendar shown in Hub until a profile exists.
- [x] Hub `/vacation` has a coloured, user-themeable background (`vacation` theme scope).
- [x] Hub `/vacation` tab menu with Profile, Vacations and Payments editable from the UI (Playwright: `packages/e2e/tests/vacation.spec.ts`).
- [x] Vacation data removed by Profile "Delete all my data" and selectable in per-feature deletion.
- [x] MCP E2E spec `packages/mcp-server/e2e/vacation.e2e.ts`.
- [x] Leave days outlined and badged in the grid; vacation totals from a tapped leave day and from expandable rows on the Vacations tab.
- [x] Configurable gross base salary replaces carry-forward for months without a row; tax regimes follow employer changes by date; full configuration view on Profile and draft explanation on the calendar.
