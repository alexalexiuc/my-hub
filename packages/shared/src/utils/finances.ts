/**
 * Finance domain utilities.
 *
 * @exports getCurrencySymbol - Returns the display symbol for a currency code (e.g. 'USD' → '$').
 * @exports isPayeeRequired - Returns whether a transaction type should involve payee selection.
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
