# Feature: Finances

| Field    | Value                     |
| -------- | ------------------------- |
| Status   | implemented               |
| Priority | high                      |
| File     | `hub/feature-finances.md` |

---

## Summary

The Finances feature provides personal budget tracking, account management, transaction logging,
category/group organisation, goals tracking, and reporting — all accessed through a shared
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

| ID    | Requirement                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TR-01 | Mobile bottom nav is implemented as `FinancesBottomNav` (`src/app/finances/FinancesBottomNav.tsx`), a `'use client'` component using `usePathname` and `useRouter`.                              |
| TR-02 | `FinancesBottomNav` is rendered only below the `md` breakpoint (`hidden` inside `FinancesBottomNav`'s outer div + `md:hidden` wrapper in layout).                                                |
| TR-03 | The desktop `FinancesSidebar` is hidden below `md` via a `hidden md:contents` wrapper in `layout.tsx`; its internal implementation is unchanged.                                                 |
| TR-04 | A shared `FinModalShell` component (`src/app/finances/FinModalShell.tsx`) handles the responsive modal/sheet wrapper, title, overlay, and outside-click handling.                                |
| TR-05 | `FinModalShell` uses Tailwind responsive classes only — `items-end` on mobile, `md:items-center md:justify-center` on desktop; no inline `style` props for layout.                               |
| TR-06 | Each creation modal passes a `className="md:max-w-[Npx]"` prop to `FinModalShell` to preserve its desktop card width.                                                                            |
| TR-07 | All form logic, schema validation, and API calls inside each creation modal remain unchanged.                                                                                                    |
| TR-08 | Bottom-nav FAB shadow uses `--fin-accent` colour with 40% opacity to match the accent palette.                                                                                                   |
| TR-09 | `FinancesBottomNav` renders the FAB above the tab bar using `−mt-5` lift so the circle visually floats above the nav strip, consistent with the reference design.                                |
| TR-10 | z-index layering: modal overlay `z-[1000]`, bottom nav `z-[900]`; sheets rendered inside the overlay do not conflict with the nav bar.                                                           |
| TR-11 | Metadata chips used across finances pages are rendered via the shared `Pill` component (`src/components/Pill.tsx`), which supports both passive badges and optional click handling.              |
| TR-12 | Finances API routes declare response Zod schemas via `route({ response: ... })` and finance UI callers use shared inferred response types from `src/app/api/finances/contracts.ts`.              |
| TR-13 | Transaction creation must derive `exchangeRate` and `toExchangeRate` in the shared service from account currencies and transaction date; client POST payload does not need exchange-rate fields. |

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
- [x] Lint and typecheck pass without errors after all changes.
