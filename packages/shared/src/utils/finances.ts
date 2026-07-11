/**
 * Finance domain utilities.
 *
 * @exports getCurrencySymbol - Returns the display symbol for a currency code (e.g. 'USD' → '$').
 * @exports isPayeeRequired - Returns whether a transaction type should involve payee selection.
 * @exports formatCardLastFour - Formats a (possibly comma-separated) cardLastFour value for display.
 * @exports computeNetWorthBreakdown - Classifies accounts into assets/liabilities and totals net worth.
 */

import { TransactionTypes, LIABILITY_ACCOUNT_TYPES, AccountTypes, type TransactionType } from '../constants/finances';
import type { FinanceAccount } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
};

/**
 * Returns the display symbol for a currency code.
 * Falls back to the currency code itself when no symbol is registered.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Returns whether a transaction type should involve payee selection.
 * Transfers do not require or use payees.
 */
export function isPayeeRequired(type: TransactionType): boolean {
  return type !== TransactionTypes.Transfer;
}

/**
 * Formats an account's `cardLastFour` value for display, masking each comma-separated
 * group individually (e.g. "1234,5678" → "•••• 1234, •••• 5678"). A card can carry more
 * than one last-4 when it's also loaded into Apple Pay/Google Pay, since phone payments
 * can bill under a different suffix than the physical card.
 */
export function formatCardLastFour(cardLastFour: string): string {
  return cardLastFour
    .split(',')
    .map(digits => `•••• ${digits.trim()}`)
    .join(', ');
}

export interface NetWorthBreakdownItem {
  accountId: number;
  name: string;
  type: FinanceAccount['type'];
  currency: FinanceAccount['currency'];
  balance: number;
}

export interface NetWorthBreakdown {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: NetWorthBreakdownItem[];
}

/**
 * Classifies accounts into assets/liabilities and totals net worth.
 * Loans store a negative balance (-remaining principal) — the absolute value is used
 * so totalLiabilities and breakdown items show the conventional positive debt amount.
 */
export function computeNetWorthBreakdown(accounts: FinanceAccount[]): NetWorthBreakdown {
  let totalAssets = 0;
  let totalLiabilities = 0;
  const breakdown: NetWorthBreakdownItem[] = [];

  for (const account of accounts) {
    const balance = account.type === AccountTypes.Loan ? Math.abs(account.balance) : account.balance;
    breakdown.push({
      accountId: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance,
    });
    if (LIABILITY_ACCOUNT_TYPES.has(account.type)) {
      totalLiabilities += balance;
    } else {
      totalAssets += balance;
    }
  }

  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, breakdown };
}
