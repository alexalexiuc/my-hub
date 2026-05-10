# Feature: Finances

| Field    | Value                     |
| -------- | ------------------------- |
| Status   | implemented               |
| Priority | high                      |
| File     | `hub/feature-finances.md` |

---

## Summary

The Finances feature provides personal budget tracking, account management, transaction logging,
category/group organisation, payee-aware transaction matching, goals tracking, and reporting — all accessed through a shared
finances layout with sidebar navigation on desktop and bottom-tab navigation on mobile.

---

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | The finances layout must display a fixed sidebar navigation on desktop (≥768 px) listing all destinations: Dashboard, Accounts, Transactions, Categories, Goals, Budget, Cashflow, Payees, Net Worth, Settings. |
| FR-02 | The finances layout must display a fixed bottom navigation bar on mobile (<768 px) with four primary tabs: Dashboard, Accounts, Categories, Settings.                                                           |
| FR-03 | The bottom nav must include a centre FAB ("+" button) that opens the Add Transaction modal directly.                                                                                                            |
| FR-04 | The active bottom-nav tab must be highlighted using the finances accent colour; inactive tabs use the muted colour.                                                                                             |
| FR-05 | The bottom nav must not obscure page content; the scrollable content area must add sufficient bottom padding to remain accessible above the nav bar on mobile.                                                  |
| FR-06 | On mobile (<768 px), all creation modals (Add Account, Add Transaction, Add Category, Add Group, Add Goal) must appear as a bottom-anchored sheet sliding up from the viewport bottom.                          |
| FR-07 | On desktop (≥768 px), all creation modals must continue to appear as centred overlay dialogs (unchanged from previous behaviour).                                                                               |
| FR-08 | All creation modals must support outside-click-to-close on both mobile and desktop.                                                                                                                             |
| FR-09 | The finances budget name and default currency must continue to be displayed in the desktop sidebar header.                                                                                                      |
| FR-10 | The desktop "Add Transaction" button in the sidebar must continue to work identically.                                                                                                                          |

---

## Technical Requirements

| ID    | Requirement                                                                                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-01 | Mobile bottom nav is implemented as `FinancesBottomNav` (`src/app/finances/FinancesBottomNav.tsx`), a `'use client'` component using `usePathname` and `useRouter`.                                                                            |
| TR-02 | `FinancesBottomNav` is rendered only below the `md` breakpoint (`hidden` inside `FinancesBottomNav`'s outer div + `md:hidden` wrapper in layout).                                                                                              |
| TR-03 | The desktop `FinancesSidebar` is hidden below `md` via a `hidden md:contents` wrapper in `layout.tsx`; its internal implementation is unchanged.                                                                                               |
| TR-04 | A shared `FinModalShell` component (`src/app/finances/FinModalShell.tsx`) handles the responsive modal/sheet wrapper, title, overlay, and outside-click handling.                                                                              |
| TR-05 | `FinModalShell` uses Tailwind responsive classes only — `items-end` on mobile, `md:items-center md:justify-center` on desktop; no inline `style` props for layout.                                                                             |
| TR-06 | Each creation modal passes a `className="md:max-w-[Npx]"` prop to `FinModalShell` to preserve its desktop card width.                                                                                                                          |
| TR-07 | All form logic, schema validation, and API calls inside each creation modal remain unchanged.                                                                                                                                                  |
| TR-08 | Bottom-nav FAB shadow uses `--fin-accent` colour with 40% opacity to match the accent palette.                                                                                                                                                 |
| TR-09 | `FinancesBottomNav` renders the FAB above the tab bar using `−mt-5` lift so the circle visually floats above the nav strip, consistent with the reference design.                                                                              |
| TR-10 | z-index layering: modal overlay `z-[1000]`, bottom nav `z-[900]`; sheets rendered inside the overlay do not conflict with the nav bar.                                                                                                         |
| TR-11 | Metadata chips used across finances pages are rendered via the shared `Pill` component (`src/components/Pill.tsx`), which supports both passive badges and optional click handling.                                                            |
| TR-12 | Finances API routes declare response Zod schemas via `route({ response: ... })` and finance UI callers use shared inferred response types from `src/app/api/finances/contracts.ts`.                                                            |
| TR-13 | Transaction creation must derive `exchangeRate` and `toExchangeRate` in the shared service from account currencies and transaction date; client POST payload does not need exchange-rate fields.                                               |
| TR-14 | The transactions list API must include balance-correction entries and expose an `isCorrection` flag so the UI can render corrections distinctly from regular income/expense rows.                                                              |
| TR-15 | When a transaction is created from a view that already renders a transaction list, the Hub UI should update that visible list locally from the successful POST response instead of forcing a full refetch.                                     |
| TR-16 | Monthly plan items with `linkedAccountId` must no longer mutate account balances when assigned amounts change; account balances remain transaction-driven only.                                                                                |
| TR-17 | Monthly Plan must support selecting an optional `incomeAccountId`; when an income transaction is recorded for that account in the same month, plan `availableAmount` (available funds) is automatically incremented by the transaction amount. |
| TR-18 | Monthly Plan item rendering must be mobile-specific below `md`: desktop keeps the table row layout, while mobile uses dedicated stacked item cards optimized for narrow viewports.                                                             |
| TR-19 | Monthly Plan Add Item row must use `react-hook-form` and shared finances input controls (`Input`, `FinancialDropdown`) rather than raw HTML inputs/selects.                                                                                    |
| TR-20 | Finance API request-body schemas that accept currency fields (`defaultCurrency`, account `currency`, monthly-plan item `currency`) must validate against the shared supported currency list (reject unknown currency codes).                   |
| TR-21 | Finance payees must support an optional single-string `alias`, and shared payee resolution used by MCP transaction flows must match by canonical payee name or alias before creating a new payee.                                              |
| TR-22 | Finance categories and groups must support optional `notes` fields, and the Hub category/group create and edit flows must allow users to view and update those notes.                                                                          |
| TR-23 | Payee-required logic must be centralized in shared utilities (`isPayeeRequired`) and reused by both Hub transaction UI and MCP transaction tools, so transfer transactions consistently bypass payee handling.                                 |
| TR-24 | The Hub Payees page must allow editing payee metadata (name, alias, description) via an edit modal and persist changes through the finances payees API.                                                                                        |

---

## Open Questions

- [ ] Should secondary destinations (Goals, Budget, Cashflow, Payees, Net Worth) be reachable via a "More" overflow item on the mobile bottom nav in a follow-up?
- [ ] Should modal entry/exit use CSS transitions (slide-up animation on mobile) as a later polish pass?

---

## Acceptance Criteria

- [x] On screens ≥768 px the sidebar is visible and the bottom nav is hidden.
- [x] On screens <768 px the sidebar is hidden and the bottom nav is visible with four tabs + FAB.
- [x] Tapping each bottom-nav tab routes to the correct finances page and highlights the active tab.
- [x] Tapping the FAB opens the Add Transaction modal as a bottom sheet on mobile.
- [x] Page content is not obscured by the bottom nav bar on any finances page.
- [x] All five creation modals (Account, Transaction, Category, Group, Goal) appear as bottom sheets on mobile and centred dialogs on desktop.
- [x] Outside-click closes the modal/sheet in both layouts.
- [x] Cancel buttons and successful submissions still close the modal and refresh data correctly.
- [x] Desktop sidebar "Add Transaction" button continues to open the transaction modal.
- [x] Finance metadata chips render through the shared `Pill` component without regressing existing styling.
- [x] Finances API responses are validated against shared Zod response schemas and finance UI uses the inferred shared response types.
- [x] Creating a transaction without exchange-rate fields still stores correct reporting and transfer exchange rates based on account currencies and transaction date.
- [x] Balance-correction entries appear in the transactions list and retain their correction-specific styling.
- [x] Creating a transaction from the transactions page or account ledger updates the visible list immediately without a full reload.
- [x] Assigning funds in monthly-plan items no longer updates account balances directly; balances stay derived from transactions.
- [x] Monthly Plan supports selecting an income account, and income transactions on that account auto-increase available funds for the matching month.
- [x] Lint and typecheck pass without errors after all changes.
- [x] On mobile monthly plan screens, plan items render as dedicated card components (not compressed desktop table rows).
- [x] Monthly Plan Add Item uses `react-hook-form` with shared Input/Dropdown controls and a supported-currency dropdown.
- [x] Finance API body schemas reject unsupported currencies for budget/account/monthly-plan write endpoints.
- [x] MCP finance transaction flows reuse an existing payee when `payeeName` matches either the canonical payee name or its configured alias.
- [x] Category and group add/edit flows in Hub persist optional notes without changing the transaction-entry UX.
- [x] Shared payee-required logic is reused by Hub and MCP so transfer transaction flows do not attempt payee selection/resolution.
- [x] The Hub Payees page allows editing payee name, alias, and description through an edit modal.
