# Feature: Finances Portfolio (ETF investment tracking)

| Field    | Value                               |
| -------- | ----------------------------------- |
| Status   | implemented                         |
| Priority | medium                              |
| File     | `hub/feature-finances-portfolio.md` |

---

## Summary

A standalone "Portfolio" section under the finances domain for tracking an ETF
portfolio (e.g. SPYL, EXUS, SXRV — Xetra-listed UCITS ETFs, EUR). Users record
monthly **supply events** (one date + total cash contributed, with per-ticker
buy lines) and the system derives current value, profit (with and without
fees), and actual-vs-target allocation. End-of-day prices are fetched and cached
automatically; charts show actual value history and compound-growth projections.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | A single Portfolio screen lives at `/finances/portfolio`, reachable from the finances sidebar and bottom-nav. Empty state offers a "Set up portfolio" flow.            |
| FR-02 | Users define positions (display ticker, name, Yahoo symbol, optional Stooq symbol, target allocation %). Target allocations must sum to 100%.                          |
| FR-03 | Users record supply events: a date, a total cash contributed, and one buy line per ticker (units, price per unit, fee). Total defaults to the sum of lines.            |
| FR-04 | Supply events can be edited and deleted; the supplies table groups by date like the source spreadsheet.                                                                |
| FR-05 | The positions table shows per-ticker units, average cost, current EOD price, value, profit (with and without fees, abs + %), actual %, target %, and deviations.       |
| FR-06 | Summary cards show current value (with staleness indicator), invested, profit, and profit excluding fees.                                                              |
| FR-07 | A history modal charts daily portfolio value vs. cumulative invested cash from the first supply to today.                                                              |
| FR-08 | A projection modal charts compound-growth scenarios (pessimistic/expected/optimistic annual return + planned monthly contribution) overlaid for 10 years.              |
| FR-09 | MCP tools expose portfolio view + CRUD: `finances_get_portfolio`, `finances_record_portfolio_supply`, `finances_update_portfolio`, `finances_delete_portfolio_supply`. |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Five new tables (`finance_portfolios`, `finance_portfolio_positions`, `finance_portfolio_supplies`, `finance_portfolio_supply_lines`, `finance_ticker_prices`). All portfolio data is budget-scoped and cascades from `finance_budgets`, so the existing `deleteAllUserFinanceBudgets` covers user deletion — no new `deleteAllUser*` function. |
| TR-02 | Supply lines carry a `type` column defaulting to `'buy'` to future-proof sells/dividends without a migration. Positions with recorded buys cannot be deleted (`onDelete: 'restrict'`).                                                                                                                                                          |
| TR-03 | `finance_ticker_prices` is a global (non-user) cache keyed by `(symbol, date)`, modeled on `finance_currency_rates`. Only actual trading days get rows.                                                                                                                                                                                         |
| TR-04 | EOD prices are fetched from the Yahoo Finance unofficial chart API (keyless) with a Stooq CSV fallback. Each `(symbol, date)` is fetched at most once; failures degrade gracefully (UI shows `—` and a stale `pricesAsOf`).                                                                                                                     |
| TR-05 | Profit semantics: `profit = value − costBasis − fees` (fee-inclusive, the lower figure); `profitExclFees = value − costBasis`.                                                                                                                                                                                                                  |
| TR-06 | The value history forward-fills non-trading days at read time from the last close; days before the first cached price are seeded with the buy price. No synthetic rows are written.                                                                                                                                                             |
| TR-07 | Reads (`getPortfolioOverview`, `getPortfolioValueHistory`) best-effort backfill the price cache before computing, so historical prices are present even if the worker has not run. A daily worker cron (`0 18 * * *` UTC) keeps prices current.                                                                                                 |
| TR-08 | All dates are `YYYY-MM-DD` strings end-to-end; date arithmetic is UTC-only. FX conversion via the existing `getExchangeRate` only when a price currency differs from the base currency.                                                                                                                                                         |
| TR-09 | Portfolio value is standalone and does NOT feed `finance_accounts` or net worth in v1.                                                                                                                                                                                                                                                          |

---

## Open Questions

- [ ] Sell and dividend transaction types (schema is ready via the `type` column; UI/MCP not yet built).
- [ ] Stock splits and ticker/ISIN renames — historical units/prices are not adjusted in v1.
- [ ] Per-day FX rates for non-EUR-listed tickers (v1 uses a single current rate per currency in the history series).
- [ ] Optional linking of portfolio value into net worth via an Investment account.

---

## Acceptance Criteria

- [x] Creating a portfolio with positions summing to 100% succeeds; 90% is rejected client- and server-side.
- [x] Recording a supply with two lines auto-computes the total and shows the event grouped by date.
- [x] Positions table shows units/cost correctly even when no EOD price is available (price columns show `—`).
- [x] Profit-with-fees is lower than profit-excluding-fees for the same position.
- [x] MCP `finances_record_portfolio_supply` resolves tickers by symbol and rejects unknown symbols.
- [x] The worker `ticker-price-sync` job fetches only missing price ranges and never throws on API failure.
