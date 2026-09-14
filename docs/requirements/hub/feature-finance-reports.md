# Feature: Finance Monthly & Yearly Reports

| Field    | Value                            |
| -------- | -------------------------------- |
| Status   | implemented                      |
| Priority | medium                           |
| File     | `hub/feature-finance-reports.md` |

---

## Summary

Two standing finance reports — **Monthly** and **Yearly** — computed on read from
`financeTransactions` and `financeNetWorthSnapshots`, reusing the existing Finances
MCP reporting building blocks wherever possible. Delivered as Hub UI pages and a
scheduled email per report (opt-out, matching the existing calorie report pattern).
Two small reporting gaps were filled to make the reports possible: per-account
opening/closing balance flow decomposition, and a savings/investment
net-contribution metric — both exposed as their own MCP tools since they're
independently useful for conversational queries, not just report internals. The
report-assembly functions themselves (`getMonthlyFinanceReport`/`getYearlyFinanceReport`)
are **not** exposed as MCP tools — most of what they compose (cashflow, net worth
history, YoY comparison) is already reachable by calling 2-3 pre-existing tools
directly, and an agent can reason about what's actually notable better than a fixed
insights script; they exist purely as the deterministic backend for the Hub pages
and the scheduled emails, neither of which has an LLM in the loop.

---

## Design decisions (gap analysis)

- **No new tables.** Both reports compute on read. `financeNetWorthSnapshots` already
  existed in the schema but had **no writer anywhere in the codebase** — `getNetWorthSummary`'s
  12-month history was silently always empty. Fixed by adding `snapshotNetWorth` (reporting.ts)
  and a monthly worker job (`finance-networth-snapshot`), rather than adding a new table.
- **Two new MCP tools only**, per the original gap analysis: `finances_get_account_flows` and
  `finances_get_savings_contributions`. `getMonthlyFinanceReport`/`getYearlyFinanceReport` compose
  these two plus five pre-existing building blocks (`getCashflowSummary`, `getBudgetProgress`,
  `getNetWorthSummary`, `getComparison`, `getSpendingAggregates`/`getSpendingByPayee`) rather than
  re-querying transactions from scratch — but are deliberately **not** registered as MCP tools
  themselves. Checked against what an agent already has: `getYearlyFinanceReport`'s net worth
  history is literally `finances_get_net_worth_summary`'s own `history` field filtered to a year,
  and its year-over-year section is literally `finances_get_comparison` with year-length ranges —
  both already directly callable. The monthly report's "insights" (fixed ±40% spike threshold,
  new-payee detection) is exactly the kind of judgment call an agent handles better contextually
  than a hardcoded script would. Keeping them as plain service functions (used only by the Hub API
  routes and the worker's email jobs, neither of which has an LLM available) avoids adding two
  tools whose main job in conversation would be re-deriving what other tools already expose.
- **`getSavingsContributions` reports every amount as both original and converted**
  (`{ original: MoneyAmount, converted: MoneyAmount }`, each `{ amount, currency }`) rather than a
  bare number silently converted to the budget's default currency. A real transaction (a direct
  expense debited from a Tracking/Goal account rather than routed through a transfer) surfaced two
  issues with a flat number: the `currency` field named the account's own currency while the
  amount itself was already budget-currency-converted (mislabeled), and a caller had no way to
  recover the pre-conversion amount at all. Every per-account figure now carries both.
- **`finances_get_savings_contributions` is generalized by account type** (Goal/Tracking/Investment),
  not hardcoded to specific account IDs — the same convention already used by
  `getSavingsAndDebtFlows` and the widget's loan-card opt-in flags. Whatever accounts a budget
  actually has of those types are picked up automatically; no account names or IDs appear in
  report code.
- **IBKR DCA-vs-target reuses the standalone Portfolio feature**, not a generic Investment-type
  account. `finance_portfolios` is explicitly documented as decoupled from `financeAccounts`/net
  worth (schema comment: "Standalone ETF tracking. Does NOT feed financeAccounts / net worth"),
  and it already has exactly the field this needs — `plannedMonthlyContribution` — plus supply
  events to sum actual contributions against it. Reusing it avoids inventing a second
  DCA-target mechanism.
- **Goal/emergency-fund progress reuses existing Goal-account `targetAmount`** (the same field
  the Goals page already renders progress bars from) rather than a new "ranked goals" concept —
  every Goal-type account gets a progress row in the monthly report; whichever one is the
  emergency fund is just data, not something the report code names.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-01 | MCP tool `finances_get_account_flows(dateFrom, dateTo, accountId?)` returns, per account: opening balance, closing balance, inflows, outflows, net delta, and a `reconciles` flag.                                                                                                                           |
| FR-02 | MCP tool `finances_get_savings_contributions(dateFrom, dateTo)` returns net transfers in/out of Goal/Tracking/Investment accounts, per account (as `{ original, converted }` `MoneyAmount` pairs) and combined, plus the same metric for the prior period.                                                   |
| FR-03 | `getMonthlyFinanceReport(userId, budgetId, month?)` (service function, not an MCP tool) assembles cashflow, account flows, savings contributions, budget progress, and insights for one month (defaults to the last completed month).                                                                        |
| FR-04 | `getYearlyFinanceReport(userId, budgetId, year?)` (service function, not an MCP tool) assembles cashflow, net worth trajectory, yearly savings contributions, IBKR-equivalent DCA-vs-target, loan payoff, category-by-month, and YoY comparison for one calendar year (defaults to the last completed year). |
| FR-05 | Monthly insights include: category spend spikes (±40% vs trailing 3-month average), payees new in the last 90 days, a data-quality flag for accounts whose flow doesn't reconcile, goal-account progress, and loan paydown for the period.                                                                   |
| FR-06 | Both reports are reachable as Hub UI pages (`/finances/reports/monthly`, `/finances/reports/yearly`), linked from the Reporting page, with month/year navigation.                                                                                                                                            |
| FR-07 | Both reports are delivered by email on a monthly (1st) / yearly (Jan 5th) schedule to opted-in users, following the existing calorie-report notification-subscription pattern (opt-out by default).                                                                                                          |
| FR-08 | A monthly worker job persists that month's net worth snapshot (`finance_net_worth_snapshots`), which previously had no writer — required for the yearly report's net worth trajectory.                                                                                                                       |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | `getAccountFlows` (`packages/shared/src/services/finances/reporting.ts`) computes opening/closing balance via the same ledger-sum formula as `recalculateAccountBalance`, date-bounded. Inflows/outflows exclude `isCorrection` transactions while balances include them, so `reconciles: false` specifically flags a correction that landed inside the period.                                                                                                                                                                                                                                              |
| TR-02 | `getSavingsContributions` filters transfers to/from `Goal`/`Tracking`/`Investment` accounts only (`SAVINGS_TRACKED_TYPES`); prior-period comparison uses an equal-length immediately-preceding window computed from the requested range's day count. Every amount is a `MoneyAmount` (`{ amount, currency }`) reported both as `original` (the account's own currency) and `converted` (the budget's default currency, via the transaction's stored `exchangeRate`); the combined `totalNetContribution` is always `converted`-currency since summing different currencies unconverted would be meaningless. |
| TR-03 | `snapshotNetWorth(userId, budgetId, month?)` (reporting.ts) computes `getNetWorthSummary` and upserts into `finance_net_worth_snapshots` on the existing `(budgetId, month)` unique index — the table's only writer.                                                                                                                                                                                                                                                                                                                                                                                         |
| TR-04 | `getAllBudgetsForSystem()` (budgets.ts) — system-maintenance query returning every budget id + creator userId (creator can never be removed as a member) — lets the net worth snapshot worker job run against all budgets without a per-user subscription gate.                                                                                                                                                                                                                                                                                                                                              |
| TR-05 | `getMonthlyFinanceReport`/`getYearlyFinanceReport` live in a new `packages/shared/src/services/finances/reports.ts`, separate from `reporting.ts`, since they contain no new data-access logic — only composition of `reporting.ts`/`accounts.ts`/`loan-amortization.ts`/`portfolio.ts` building blocks.                                                                                                                                                                                                                                                                                                     |
| TR-06 | Loan paydown for interest-bearing loans uses `calculateLoanAmortizationSummary` (pure, schedule-derived) — the documented single source of truth for loan balances (TR-26/TR-42 of `feature-finances.md`). Zero-interest loans reuse the already-computed `getAccountFlows` ledger balance for that account instead (every payment is pure principal, so the raw ledger is exact — computing it a second way would risk disagreeing with itself).                                                                                                                                                            |
| TR-07 | MCP tools `finances_get_account_flows` and `finances_get_savings_contributions` are registered in `packages/mcp-server/src/finances/tools/{reporting.ts,tools.ts}`, both `readOnlyHint: true`. `getMonthlyFinanceReport`/`getYearlyFinanceReport` are deliberately not registered as tools — see Design decisions.                                                                                                                                                                                                                                                                                           |
| TR-08 | Worker jobs `finance-networth-snapshot` (07:00 1st of month), `finance-monthly-report` (08:00 1st of month), `finance-yearly-report` (08:00 Jan 5th) registered in `packages/worker/src/poll.ts`. The snapshot job runs first so the monthly report's reconciliation view and the yearly report's trajectory see a fresh snapshot.                                                                                                                                                                                                                                                                           |
| TR-09 | `finance_monthly_report`/`finance_yearly_report` notification subscription keys added to `NOTIFICATION_SUBSCRIPTIONS` (section "Finances") — automatically renders in the Profile notifications UI via the existing config-driven `NotificationsSection`, no UI changes needed.                                                                                                                                                                                                                                                                                                                              |
| TR-10 | Email templates `packages/shared/src/services/email/templates/finance-{monthly,yearly}-report/` follow the existing calorie-report template's design tokens (dark, IBM Plex Mono/Sans) but use CSS-only stat cards/tables instead of QuickChart images, since the report already has a Hub UI page for visual drill-down.                                                                                                                                                                                                                                                                                    |
| TR-11 | `GET /api/finances/reports/monthly` and `GET /api/finances/reports/yearly` (`packages/hub/src/app/api/finances/reports/{monthly,yearly}/route.ts`) wrap `getMonthlyFinanceReport`/`getYearlyFinanceReport` with full Zod response schemas per the finances API convention.                                                                                                                                                                                                                                                                                                                                   |
| TR-12 | Hub pages at `packages/hub/src/app/finances/reports/{monthly,yearly}/` are split into a thin `page.tsx` (fetch + month/year navigation) plus co-located section components, each under the package's 300-line page limit.                                                                                                                                                                                                                                                                                                                                                                                    |

---

## Open Questions — defaults chosen (see design decisions above for rationale)

- [x] **Delivery preference**: implemented all three — Hub UI page, MCP tool (conversational), and a monthly/yearly email — opt-out by default like the existing calorie reports, so nothing changes for a user until they explicitly unsubscribe.
- [x] **Spike/drop threshold**: ±40% vs trailing 3-month average, as suggested in the original issue. Not yet user-configurable; revisit if it proves noisy in practice.
- [x] **Yearly goal projection**: reports current state only (balance vs target, % complete) — no completion-date projection. The existing Goals page's `projectedMonths` field already exists for a per-goal projection if that view is wanted later; the yearly report doesn't duplicate it.

---

## Acceptance Criteria

- [x] `finances_get_account_flows` returns opening/closing balance, inflows, outflows, net delta, and a `reconciles` flag per account for a date range, optionally filtered to one account.
- [x] `finances_get_savings_contributions` returns a combined total, per-account breakdown (each with `original` and `converted` `MoneyAmount`s), and the same metric for the immediately preceding period of equal length.
- [x] `getMonthlyFinanceReport` defaults to the last completed month and composes cashflow, account flows, savings contributions, budget progress, and insights — reachable via the Hub page and the monthly email, not an MCP tool.
- [x] `getYearlyFinanceReport` defaults to the last completed calendar year and composes cashflow, net worth trajectory, savings contributions, IBKR DCA-vs-target, loan payoff, 12-month category table, and YoY comparison — reachable via the Hub page and the yearly email, not an MCP tool.
- [x] A monthly worker job populates `finance_net_worth_snapshots` so the yearly report's net worth trajectory has data.
- [x] Monthly/yearly report emails are opt-out (subscribed by default) and appear under a "Finances" section in the Profile notifications UI with no additional UI code.
- [x] `/finances/reports/monthly` and `/finances/reports/yearly` render in the Hub with month/year navigation and are linked from the Reporting page.
- [x] The two new MCP tools, the two new shared reporting functions, the report assembly functions, the worker jobs, and the Hub API routes pass lint, typecheck, and existing test suites with no regressions.
