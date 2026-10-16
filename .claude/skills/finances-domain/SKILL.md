---
name: finances-domain
description: |
  Domain rules for the finances feature — load before changing anything in packages/shared/src/services/finances,
  packages/shared/src/db/schema/finances.ts, packages/hub/src/app/finances, the finances API routes, or
  packages/mcp-server/src/finances. Covers the multi-currency money model, balances, liabilities, loans, reporting,
  net worth, monthly plans and the portfolio.
metadata:
  scope: monorepo
  stage: implementation
---

# Finances domain

Exports: `pnpm inventory packages/shared/src/services/finances --docs`. Spec: `docs/requirements/hub/feature-finances.md`
(+ `feature-finance-reports.md`, `feature-finances-portfolio.md`).

## Money model (`transaction-money.ts` is the single owner)

- `amount` is always in the **source account's currency**. Input may come as `amountCurrency` + optional user
  `rate`; it is converted (user rate, else the transaction-date market rate) and the original kept in
  `extras.conversion` (`rateSource`, `rateDate`). Read it back with `getOriginalInput(extras)`.
- Transfers carry `toAmount` in the destination currency (required when currencies differ, unless the amount was
  entered in the destination currency). Read it with `transferToAmount(t)`; in SQL aggregates `transferToAmountSql`.
- `reportingAmount` is **frozen** in the budget's default currency at write time, with a consistent
  `exchangeRate`. Every cross-account sum uses it. Per-account flows stay in the account currency.
- Callers never pass derived fields (rate, reporting value, balances). Updates re-resolve money only when the money
  input actually changes. Corrections get a best-effort reporting value (any known rate, else 0) so they never fail.
- Rates: `getExchangeRateQuote` is the **strict** lookup for anything stored (exact row or API fetch, else nearest
  cached within 7 days, else throws `ExchangeRateUnavailableError` — never 1.0). `getExchangeRate` is legacy,
  lenient, display-only.
- Columns: money/rates use `numericCasted` (`numeric(18,4|8)`) in `schema/finances.ts` — the one exception to the
  `real()` rule.

## Balances, liabilities, net worth

- Ledger balance = `getLedgerBalances(accountIds, { asOfDate })` (transfer destinations credited with `toAmount`).
  `recalculateAccountBalance` uses it; don't hand-roll another sum.
- `isLiabilityAccount(type, direction)` (`utils/finances.ts`) is the only liability classifier: loans, credit
  cards, and Borrowed/Lent only with direction `received` (money lent is an asset). Liabilities are exposed as the
  positive amount owed. Every net-worth / available view goes through it.
- Interest-bearing loans: display balance = amortization-derived remaining principal
  (`getLoanDisplayBalance` / `getLoanCardBalance`), not the raw ledger. Zero-interest loans use the ledger.
  `calculateLoanAmortizationSummary` is the single source of truth for paydown.
- "Available" = included accounts (default bank + cash; per-user overrides in `financeAccountAvailability`) at
  today's rate, liabilities subtracted.
- `snapshotNetWorth` is the only writer of `finance_net_worth_snapshots` (monthly worker job; unique per
  budget+month). Yearly reports read those rows.

## Access and budgets

- Everything is scoped by `budgetId`; access is membership in `financeBudgetMembers` (`enforceBudgetAccess`,
  `hasAccessToBudget`). The budget creator can never be removed. `*System` functions skip auth and are for
  worker/maintenance callers only.
- `includeInSpendingBudget` (category, default true) controls only the aggregate budget total in
  `getBudgetProgress`; per-category rows are unaffected.

## Other rules

- Every transaction mutation updates payee stats (`increment/decrementPayeeStats`) and syncs monthly plans
  (`syncTransactionWithPlan`, using the frozen `reportingAmount`). Keep that when adding write paths.
- Payees match case-insensitively by `normalizedName` + aliases (`upsertPayee`, `resolvePayeeIdByNameOrAlias`).
- Labels are a string array on the transaction row; the labels table is autocomplete only (`syncLabels`).
- Portfolio (`portfolio.ts`, `tickerPrices.ts`) is standalone: it does **not** feed net worth or
  `financeAccounts`. Prices: Yahoo chart API, Stooq fallback, cached per (symbol, trading day).
  Cadence math lives in `utils/portfolio.ts` `computeContributionCadence`.
- `reports.ts` only composes existing building blocks — no new data access there.

## UI and tests

- Hub pages: `packages/hub/src/app/finances/` (accounts, cashflow, monthly plan, portfolio, reports). Amount
  columns are what overflows at 390px — check mobile with the `ui-sandbox` skill.
- Specs: `packages/e2e/tests/finances-*.spec.ts` (helpers in `finances-helpers.ts`; desktop/mobile duplicates →
  `[data-layout="desktop"]`), MCP: `packages/mcp-server/e2e/finances*.e2e.ts`.
- Sandbox demo budget: built inline in `seedSandboxFixtures` (`packages/e2e/seeds/sandbox.seed.ts`).
