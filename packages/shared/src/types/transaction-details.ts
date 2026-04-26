// ---- Transaction details (financeTransactions.extras) ───────────────────
// Discriminated union — kind drives which shape is expected.
// Use TransactionDetails as the root; extend for each entry type.
// Use BaseTransactionDetails for types without a dedicated shape yet.

export interface TransactionDetails {
  readonly kind: string;
  // Entry channel — where the transaction arrived from: 'mcp' | 'hub' | 'import'
  source?: string;
  // Raw input the AI parsed this from (user message, OCR text, etc.)
  rawInput?: string;
  // Card hint used to match to an account (e.g. "Visa *4242")
  cardHint?: string;
  // Confidence score (0–1) when category/payee was auto-suggested
  autofillConfidence?: number;
  /** Open bag — AI may add any extra fields it considers relevant. */
  extra?: Record<string, unknown>;
}

// Manual entry — minimal metadata, no line items expected.
export interface ManualTransactionDetails extends TransactionDetails {
  readonly kind: 'manual';
}

// Receipt scan — AI-populated from a photo or OCR'd bill.
export interface ReceiptTransactionDetails extends TransactionDetails {
  readonly kind: 'receipt';
  payeeName?: string;
  payeeAddress?: string;
  receiptNumber?: string;
  taxAmount?: number;
  tipAmount?: number;
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
