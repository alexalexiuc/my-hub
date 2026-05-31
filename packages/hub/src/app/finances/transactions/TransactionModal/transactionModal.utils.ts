import type { TransactionType } from '@my-hub/shared/constants';
import { TransactionTypes } from '@my-hub/shared/constants';

export const MOBILE_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionTypes.Expense]: '- Outflow',
  [TransactionTypes.Income]: '+ Inflow',
  [TransactionTypes.Transfer]: '⇄ Transfer',
};

export function formatMobileAmount(value: string, currencyCode: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return `0.00${currencyCode}`;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + currencyCode;
}

/** Format raw cents (e.g. "110050") as a currency-suffixed string: "1,100.50MDL". */
export function formatDigitsWithCurrency(digits: string, currency: string): string {
  const n = digits ? parseInt(digits, 10) / 100 : 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + currency;
}

/** Format raw cents without trailing zeros for the compact expression strip: "1100.50" → "1100.5". */
export function formatDigitsCompact(digits: string): string {
  if (!digits) return '0';
  const n = parseInt(digits, 10) / 100;
  return n.toFixed(2).replace(/\.?0+$/, '');
}
