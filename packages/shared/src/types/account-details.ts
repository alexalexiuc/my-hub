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

import type {
  DepositCapitalizationFrequency,
  DepositInstrument,
  DepositPayout,
  DepositRateType,
  DepositStatus,
  LentDirection,
} from '../constants';

/** Root shape shared by all account detail variants. */
export interface BaseAccountDetails {
  readonly type: string;
}

export interface BankAccountDetails extends BaseAccountDetails {
  readonly type: 'bank';
  interestRate?: number;
  savingsGoal?: number;
  /**
   * Last 4 digits of the card, comma-separated when the same underlying card shows
   * multiple statement suffixes — e.g. the physical card and a tokenized Apple Pay/Google Pay
   * wallet version can each print a different last-4 on statements. Example: "1234,5678".
   */
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
  /**
   * Last 4 digits of the card, comma-separated when the same underlying card shows
   * multiple statement suffixes — e.g. the physical card and a tokenized Apple Pay/Google Pay
   * wallet version can each print a different last-4 on statements. Example: "1234,5678".
   */
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
  firstPaymentDate: string; // YYYY-MM-DD — anchors the payment schedule; may differ from when the loan was contracted
  linkedItemName?: string;
}

/** An earlier payout/capitalization mode of a deposit and the date it took effect (kept when the mode changes). */
export interface DepositModeSegment {
  from: string; // YYYY-MM-DD, first day the mode applied
  payout: DepositPayout;
  capitalizationFrequency?: DepositCapitalizationFrequency;
}

/** A fixed-term deposit (or bond) — money placed at a known rate for a known term. */
export interface DepositAccountDetails extends BaseAccountDetails {
  readonly type: 'deposit';
  institution: string;
  productName?: string;
  instrument: DepositInstrument;
  principal: number; // account currency
  interestRate: number; // annual nominal, %
  rateType: DepositRateType;
  fixedMonths?: number; // only for fixed_then_floating
  startDate: string; // YYYY-MM-DD
  termMonths: number; // maturity date is derived from startDate + termMonths
  payout: DepositPayout;
  capitalizationFrequency?: DepositCapitalizationFrequency; // only when payout is capitalized; default monthly
  modeEffectiveDate?: string; // date the current payout/capitalization mode began; defaults to startDate
  modeHistory?: DepositModeSegment[]; // earlier modes, oldest first; empty until the mode is changed mid-term
  reinvestRate?: number; // % — assumed rate on paid-out interest for the capitalization comparison
  payoutAccountId?: number; // required unless payout is capitalized; where net interest lands
  returnAccountId?: number; // where principal returns at maturity; defaults to payoutAccountId
  taxRate: number; // % withheld at source
  tranches?: number; // identical bank deposits represented by this account (informational)
  earlyExitRule?: string;
  autoRenew?: boolean;
  guaranteeLimit?: number;
  status: DepositStatus;
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
  | DepositAccountDetails
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
