# Finances: `deposit` account type (draft v0.2)

Status: **draft**. v0.1 (idea) plus an impact audit of the current code. Owner: Alex.
Area: Finances (shared services, MCP, Hub UI, worker, reports).

## 1. Problem

`loan` models borrowed money with a schedule. Nothing models money **placed** at a fixed rate for a fixed term. Today a term deposit is a `tracking` account (no rate, maturity or income) or a `bank` account with `interestRate` (floating, no term). The system cannot say how much it will earn, when it matures, what returns net of tax, or when to act.

## 2. Goal

A `deposit` account type that mirrors `loan` in reverse: money goes in, earns a known rate for a known term, pays interest, and returns at maturity. The system projects income and alerts before maturity.

First real use: **MICB Maestro Online**, 200,000 MDL, 8% fixed, 12 months, monthly payout, matures about 2027-11-17. Held as several sub-deposits at the bank, tracked as **one** account.

## 3. Scope

**v1:** bank term deposits in any currency; fixed rate; payout `monthly | quarterly | semiannual | at_maturity | capitalized`; tax withheld at source; several identical tranches as one account.

**Later:** state bonds (`instrument = state_bond`, tax 0, coupon every 6 months); floating rate with rate history; auto-renew chains.

**Out:** bank sync; term-less savings (stay `bank` + `interestRate`).

## 4. Data model

`details` for `type: 'deposit'` (add `DepositAccountDetails` to `types/account-details.ts`, extend the `AccountDetails` union and `getAccountDetails`). camelCase; enum-like values as `as const` objects in `constants/finances.ts`.

| Field             | Type                                                                       | Req | Notes                                                                       |
| ----------------- | -------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------- |
| `institution`     | string                                                                     | ✓   |                                                                             |
| `productName`     | string                                                                     |     |                                                                             |
| `instrument`      | `bank_deposit` \| `state_bond`                                             | ✓   | default `bank_deposit`                                                      |
| `principal`       | number                                                                     | ✓   | account currency                                                            |
| `interestRate`    | number (%)                                                                 | ✓   | annual nominal                                                              |
| `rateType`        | `fixed` \| `fixed_then_floating` \| `floating`                             | ✓   | v1 computes `fixed` only; others stored, summary flagged "estimate"         |
| `fixedMonths`     | int                                                                        |     | only `fixed_then_floating`                                                  |
| `startDate`       | date                                                                       | ✓   |                                                                             |
| `termMonths`      | int                                                                        | ✓   | store this; derive `maturityDate = addMonthsKeepDay(startDate, termMonths)` |
| `payout`          | `monthly` \| `quarterly` \| `semiannual` \| `at_maturity` \| `capitalized` | ✓   |                                                                             |
| `payoutAccountId` | id                                                                         | \*  | required unless `capitalized`; net interest lands here                      |
| `returnAccountId` | id                                                                         |     | defaults to `payoutAccountId`                                               |
| `taxRate`         | number (%)                                                                 | ✓   | default 6 (MD bank), 0 (state bond)                                         |
| `tranches`        | int                                                                        |     | informational, default 1                                                    |
| `earlyExitRule`   | text                                                                       |     |                                                                             |
| `autoRenew`       | bool                                                                       |     | stored only in v1                                                           |
| `guaranteeLimit`  | number                                                                     |     | warn when principal + capitalized interest exceeds it                       |
| `status`          | `active` \| `matured` \| `broken`                                          | ✓   | stored (set by close action); `active` otherwise                            |

Validation: `payoutAccountId`/`returnAccountId` must exist in the same budget; throw `UserInputError` for bad input. No new table, so **no `deleteAllUser*` work**. No schema migration: `type` is a text column typed via `.$type<>()` and `details` is JSONB. Confirm with `pnpm db:generate` that nothing is generated.

## 2b. Decisions on the open questions (proposed defaults)

1. **Tranches:** one account, informational count. Breaking one tranche is a partial principal reduction (a transfer out plus a `principal` edit). Revisit if it happens.
2. **Tax:** store it in the transaction `extras` (`gross`, `tax`, `net`) on a single **net** income row. A separate expense row would distort cashflow and budget.
3. **Expected interest:** v1 logs manually with the amount pre-filled from the summary. Auto-generated expected rows are v2.
4. **State bonds:** v2, but the model already carries `instrument` and `taxRate`.
5. **EUR deposits:** no special case. The account currency is EUR and net worth converts at the current rate.
6. **Rate history:** v2 (floating).

## 5. Behaviour

- **Open:** `finances_add_deposit` creates the account and records the funding as a **transfer** from the source account. It never writes a correction (unlike `finances_add_loan`). The ledger balance of the deposit equals the principal.
- **Interest:** income of the net amount to `payoutAccountId` with a new category **Venituri > Interest** (none exists today; create or reuse via `upsertCategory`). When `capitalized`, record income into the deposit itself.
- **Maturity:** transfer of the principal to `returnAccountId`, `status = matured`, account archived.
- **Early break:** transfer of the principal back, optional clawback expense of interest already paid (per `earlyExitRule`), `status = broken`, archived.
- Money rules follow `finances-domain`: amounts in the account currency, `reportingAmount` frozen, cross-currency transfers carry `toAmount`.

## 6. `depositSummary`

New `packages/shared/src/services/finances/deposit-summary.ts`, mirroring `loan-amortization.ts`: a pure `calculateDepositSummary(details, { asOfDate, interestReceived })` plus a service wrapper that sums received interest from the payout transactions. Reuse `addMonthsKeepDay` and `daysBetweenDateStr`; no local date maths.

Fields: `maturityDate`, `daysToMaturity`, `expectedGrossInterest`, `expectedTax`, `expectedNetInterest`, `interestReceivedToDate` (net), `interestRemaining`, `nextPayoutDate`, `nextPayoutAmount`, `effectiveNetYield`, `overGuarantee`.

Check against the MICB example: 200,000 × 8% = 16,000 gross, tax 960, net 15,040 over the term; monthly net about 1,253.33.

## 7. Impact audit (what changes, by layer)

Order: shared → mcp-server → hub → worker → docs/e2e.

### 7.1 shared

| File                                        | Change                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants/finances.ts`                     | Add `AccountTypes.Deposit`; entries in `ACCOUNT_TYPE_NAMES` and `ACCOUNT_TYPE_DESCRIPTIONS`; `DepositPayouts`, `DepositInstruments`, `DepositRateTypes`, `DepositStatuses`; re-export `DepositAccountDetails`. **Not** in `LIABILITY_ACCOUNT_TYPES`, **not** in `EXPENSE_ACCOUNT_TYPES`/`CASHFLOW_ACCOUNT_TYPES` (funding and return are transfers)                                                                                           |
| `types/account-details.ts`                  | `DepositAccountDetails`, union, doc comment                                                                                                                                                                                                                                                                                                                                                                                                   |
| `services/finances/deposit-summary.ts`      | New (section 6) + unit test; export from `index.ts`                                                                                                                                                                                                                                                                                                                                                                                           |
| `services/finances/accounts.ts`             | Check `createAccount`/`updateAccount` details validation and the liability branch near line 349; the header JSDoc mentions loan-only widget flags                                                                                                                                                                                                                                                                                             |
| `services/finances/reporting.ts`            | Net-worth summary (loan branch around line 1367): deposits count as assets at ledger balance (principal + capitalized interest), grouped as "Deposits". `getSavingsAndDebtFlows` (`trackedTypes`, around line 353): decide whether deposit funding counts as `savings` or `investments` (proposal: **savings**, net of returns); `getAccountsCashflow` only counts transfers into loans as spending, so deposit funding is correctly excluded |
| `services/finances/reports.ts`              | Monthly/yearly reports: add a `deposits` section (principal, interest earned in period, next maturity) next to `loans`; interest income already flows through cashflow                                                                                                                                                                                                                                                                        |
| `services/email/templates/finance-*-report` | Render the new `deposits` rows (these templates already render `loans`)                                                                                                                                                                                                                                                                                                                                                                       |
| `constants/notifications.ts`                | New subscription `finance_deposit_alerts` (section Finances). Keys are plain text, no migration                                                                                                                                                                                                                                                                                                                                               |
| `services/notifications`                    | Check `config.ts` for per-key wiring                                                                                                                                                                                                                                                                                                                                                                                                          |

### 7.2 mcp-server (`src/finances`)

- `tools/accounts.ts`: `upsert_account` details union gets `z.literal('deposit')` (loan sits at line 90); new `finances_add_deposit` (funding transfer, returns `depositSummary`); new `finances_close_deposit` (`reason: matured | broken`).
- `finances_get_deposit_schedule`: **not a separate tool**. Put `depositSummary` in `list_context` like `amortizationSummary` (`tools/context.ts` and `resources/context.ts`, `resources/account.ts`) and expose the per-date schedule in the `add_deposit` result. Keeps the surface task-oriented.
- `tools/transactions.ts`: line 52 resolves loan display balance after writes; deposits need no override (ledger balance is correct).
- `tools/tools.ts`: register the new tools. Update tool descriptions, `list-tools`, and the `docs/requirements/mcps` finances doc.
- Tests: `accounts.test.ts`, `transactions.test.ts`; MCP e2e in `packages/mcp-server/e2e/finances*.e2e.ts` (open, log payout, close).

### 7.3 hub API (`src/app/api/finances`)

- `accounts/route.ts`: deposit variant in the body schema (loan at line 55), details build (line 171), list output carries `depositSummary`; `accounts/[id]/route.ts` GET/PATCH (loan handling at line 121).
- `networth/route.ts`: no loan-style override; verify deposits land in `assets` and the response gains a `Deposits` grouping.
- `dashboard/route.ts` and `reporting/route.ts`: loan-repayment logic keys on loan accounts only, so deposit funding transfers stay out of spending. Add a test to lock that in.
- New `POST /api/finances/accounts/[id]/close` (or reuse PATCH) for maturity/break.

### 7.4 hub UI (`src/app/finances`)

- `ui.tsx` `TYPE_META`: `deposit` (label, colour `--teal`/`--green`, icon, e.g. 🔒).
- `accounts/accountOptions.ts`, `accounts/accounts.utils.ts` `ACCOUNT_GROUPS`: add "Deposits" (after Investments, before Tracking).
- `finances-form.schema.ts` (lines 184 and 278) and `accounts/AccountModal.tsx` (lines 146, 264, 337): deposit form (rate, term, start date, payout, payout/return account pickers, tax, tranches). The `type !== Loan && !== Investment` balance-field rule needs the deposit case.
- `accounts/page.tsx`: row extras for deposits (rate, maturity countdown).
- `accounts/AccountDetailView.tsx`: deposit block (progress bar start → maturity, net earned, next payout, return date), a "Log interest" action pre-filled from the summary, a "Close / break" action. Line 196 `isLiability` stays loan/credit-card only.
- `FinancesWidget.tsx` + dashboard route: optional deposit card (maturity countdown) behind a `showOnWidget` flag; reuse the loan widget plumbing (`settings/LoanWidgetSection.tsx` → generalize to "Accounts shown on widget"). v1 may skip this; keep it as an open item.
- Net worth page: new "Deposits" group between cash and investments.
- Transaction modal: transfers into a deposit must be selectable (they are, since only expense/income restrict types); check labels.
- Mobile 390px: amount columns overflow first; check with `ui-sandbox`.
- Theming: tokens only, per `hub-theming`.

### 7.5 worker

- New job `finance-deposit-alerts` in `src/poll.ts`: daily, fires (a) N days before maturity (default 14) and (b) on a missed expected payout (no interest income by payout date + 3 days). Alerts only when a rule fires; no digest. Recipients come from the `finance_deposit_alerts` subscription. Uses `logger`, shared services only; see `worker-email-reports`.
- `finance-networth-snapshot` and `finances-balance-recalc` need no change (they go through the shared net worth and ledger paths); verify `recalculateAccountBalance` is right for deposits (plain ledger).

### 7.6 Docs, seeds, tests

- Update `docs/requirements/hub/feature-finances.md` (new TRs for type, summary, MCP, net worth), `feature-finance-reports.md` (deposits section), `feature-email-notifications.md` (new subscription), `docs/requirements/mcps` finances doc.
- Add a deposit to `seedSandboxFixtures` in `packages/e2e/seeds/sandbox.seed.ts`.
- `packages/e2e/tests/finances-accounts.spec.ts`: create deposit, see summary, log interest.
- Unit tests: summary maths (MICB example), net worth classification (asset, not liability), `getSavingsAndDebtFlows`.

## 8. Migration

Convert **Deposit MDL** (id 27, `tracking`, balance 0): not convertible in place (type is fixed by `upsert_account`? verify). Default: archive it and create the MICB deposit via `finances_add_deposit` so the funding transfer is real.

## 9. Acceptance (v1)

- [ ] One `finances_add_deposit` call creates the MICB Maestro deposit (200,000 MDL, 8%, 12 months, monthly, 6% tax); the source account drops by 200k.
- [ ] `list_context` shows `depositSummary` with expected net interest about 15,040 MDL and maturity 2027-11-17.
- [ ] Logging a payout adds about 1,253 MDL income to the payout account; `interestReceivedToDate` updates.
- [ ] Funding and return transfers do not count as spending in dashboard, cashflow or reporting.
- [ ] Net worth counts the deposit as an asset in a "Deposits" group (Hub, MCP summary, monthly snapshot).
- [ ] Monthly/yearly report and email show a deposits section.
- [ ] Alert fires 14 days before maturity and on a missed payout.
- [ ] Closing at maturity returns 200k to the return account and the deposit leaves active net worth.
- [ ] Hub forms, account list/detail and mobile layout work; e2e specs pass.
