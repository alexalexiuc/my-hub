// ---- Account details (financeAccounts.details) ───────────────────────────
// Discriminated union — `type` mirrors the account's AccountType value so
// narrowing on `account.type` automatically narrows `account.details`.
//
// Usage:
//   if (account.type === 'loan') {
//     const details = account.details as LoanAccountDetails; // fully typed
//   }
//
// Use BaseAccountDetails for account types that carry no structured data yet.

import { LentDirection } from '../constants';

/** Root shape shared by all account detail variants. */
export interface BaseAccountDetails {
  readonly type: string;
}

export interface BankAccountDetails extends BaseAccountDetails {
  readonly type: 'bank';
  interestRate?: number;
  savingsGoal?: number;
  cardLastFour?: string;
  cardName?: string;
}

export interface CashAccountDetails extends BaseAccountDetails {
  readonly type: 'cash';
  savingsTarget?: number;
}

export interface CreditCardAccountDetails extends BaseAccountDetails {
  readonly type: 'credit_card';
  creditLimit: number;
  statementDay: number; // day of month (1–31)
  cardLastFour?: string;
  cardName?: string;
}

export interface InvestmentAccountDetails extends BaseAccountDetails {
  readonly type: 'investment';
  deposited: number; // sum of transfers in; updated on each inbound transfer
}

export interface LoanAccountDetails extends BaseAccountDetails {
  readonly type: 'loan';
  principal: number;
  interestRate: number; // 0 for interest-free installment plans
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  linkedItemName?: string;
}

export interface BorrowedLentAccountDetails extends BaseAccountDetails {
  readonly type: 'borrowed_lent';
  counterpartyName: string;
  direction: LentDirection;
  dueDate?: string; // YYYY-MM-DD
  settled: boolean;
}

export interface GoalAccountDetails extends BaseAccountDetails {
  readonly type: 'goal';
  targetAmount: number;
}

export interface TrackingAccountDetails extends BaseAccountDetails {
  readonly type: 'tracking';
}

/**
 * Discriminated union of all account detail shapes.
 * Narrowing on `account.type` resolves the concrete details interface.
 */
export type AccountDetails =
  | BankAccountDetails
  | CashAccountDetails
  | CreditCardAccountDetails
  | InvestmentAccountDetails
  | LoanAccountDetails
  | BorrowedLentAccountDetails
  | GoalAccountDetails
  | TrackingAccountDetails;

/**
 * Narrows `details` to the concrete shape for the given `type`.
 * Returns `null` for account types that legitimately have no details,
 * or when `details` is missing/malformed.
 */
export function getAccountDetails<T extends AccountDetails['type']>(
  type: T,
  details: unknown,
): Extract<AccountDetails, { type: T }> | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as AccountDetails;
  if (d.type !== type) return null;
  return d as Extract<AccountDetails, { type: T }>;
}
