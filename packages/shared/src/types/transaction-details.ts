// ---- Transaction details (financeTransactions.extras) ───────────────────
// Discriminated union — kind drives which shape is expected.
// Use TransactionDetails as the root; extend for each entry type.
// Use BaseTransactionDetails for types without a dedicated shape yet.

export interface TransactionConversionMeta {
  // User-entered amount before conversion (for example amount from receipt abroad).
  originalAmount?: number;
  // ISO 4217 currency of originalAmount (for example EUR, USD, RON).
  originalCurrency?: string;
  // Account currency that ledger amount was converted into.
  accountCurrency?: string;
  // FX rate used to convert originalAmount -> accountCurrency.
  originalToAccountRate?: number;
  // Final amount stored in ledger/account currency.
  convertedAmount?: number;
}

export interface TransactionExtra {
  [key: string]: unknown;
}

export interface TransactionDetails {
  readonly kind: string;
  /** Entry channel — where the transaction arrived from: 'mcp' | 'hub' | 'import' */
  source?: string;
  /** Raw input the AI parsed this from (user message, OCR text, etc.) */
  rawInput?: string;
  /** Card hint used to match to an account (e.g. "Visa *4242") */
  cardHint?: string;
  /** Confidence score (0–1) when category/payee was auto-suggested */
  autofillConfidence?: number;
  /** Time of the transaction in HH:MM 24-hour format (timezone-agnostic). Populated by AI from receipts. */
  time?: string;
  /** Optional typed conversion metadata for foreign-currency entries. */
  conversion?: TransactionConversionMeta;
  /** Optional metadata bag for ad-hoc fields not modeled explicitly. */
  extra?: TransactionExtra;
}

// Manual entry — minimal metadata, no line items expected.
export interface ManualTransactionDetails extends TransactionDetails {
  readonly kind: 'manual';
}

// Receipt scan — AI-populated from a photo or OCR'd bill.
export interface ReceiptTransactionDetails extends TransactionDetails {
  readonly kind: 'receipt';
  payeeAddress?: string;
  receiptNumber?: string;
  taxAmount?: number;
  tipAmount?: number;
  deliveryAmount?: number;
  discountAmount?: number;
  items?: ReceiptLineItem[];
}

export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  unit?: string; // 'kg' | 'pcs' | 'l' etc.
  unitPrice?: number;
  totalPrice?: number;
  // AI may optionally suggest a category for a line item — informational only,
  // does not affect the transaction's categoryId.
  categoryHint?: string;
}

// Fallback — for entry types without a dedicated shape yet.
export interface BaseTransactionDetails extends TransactionDetails {
  readonly kind: 'base';
}
