/**
 * Finance domain utilities.
 *
 * @exports getCurrencySymbol - Returns the display symbol for a currency code (e.g. 'USD' → '$').
 * @exports isPayeeRequired - Returns whether a transaction type should involve payee selection.
 * @exports formatCardLastFour - Formats a (possibly comma-separated) cardLastFour value for display.
 */

import { TransactionTypes, type TransactionType } from '../constants/finances';

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
