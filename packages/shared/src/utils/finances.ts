/**
 * Finance domain utilities.
 *
 * @exports getCurrencySymbol - Returns the display symbol for a currency code (e.g. 'USD' → '$').
 * @exports isPayeeRequired - Returns whether a transaction type should involve payee selection.
 * @exports formatCardLastFour - Formats a (possibly comma-separated) cardLastFour value for display.
 * @exports quoteTransferRate - Effective rate of a cross-currency transfer as {rate, base, quote}, weaker-per-stronger.
 * @exports isLiabilityAccount - Whether an account subtracts from net worth / available balance (loans, credit cards, money borrowed).
 */

import {
  AccountTypes,
  LIABILITY_ACCOUNT_TYPES,
  LentDirections,
  TransactionTypes,
  type AccountType,
  type LentDirection,
  type TransactionType,
} from '../constants/finances';

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

/**
 * Effective rate of a cross-currency transfer, quoted the way people read it: units of the weaker
 * currency per one unit of the stronger (6033.03 MDL → 300 EUR gives 20.1101 MDL per EUR; 92 EUR →
 * 100 USD gives 1.087 USD per EUR). Null when either side is missing or zero.
 */
export function quoteTransferRate(
  sentAmount: number,
  sentCurrency: string,
  receivedAmount: number,
  receivedCurrency: string,
): { rate: number; base: string; quote: string } | null {
  if (!(sentAmount > 0) || !(receivedAmount > 0)) return null;
  const sentPerReceived = sentAmount / receivedAmount;
  return sentPerReceived >= 1
    ? { rate: Math.round(sentPerReceived * 10000) / 10000, base: receivedCurrency, quote: sentCurrency }
    : { rate: Math.round((receivedAmount / sentAmount) * 10000) / 10000, base: sentCurrency, quote: receivedCurrency };
}

/**
 * Returns whether an account is a liability — its balance subtracts from net worth and available balance.
 * Loans and credit cards always are. A Borrowed/Lent account depends on its direction: money borrowed
 * (`received`) is owed back, so it is a liability; money lent (`gave`) is an asset — not immediately
 * liquid, but still owed to the user. Every net-worth/available view must classify through this.
 *
 * @param type - The account type.
 * @param direction - The Borrowed/Lent account's direction (ignored for other types).
 */
export function isLiabilityAccount(type: AccountType, direction?: LentDirection | null): boolean {
  if (type === AccountTypes.BorrowedLent) return direction === LentDirections.Received;
  return LIABILITY_ACCOUNT_TYPES.has(type);
}
