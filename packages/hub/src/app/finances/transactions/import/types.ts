import type { TransactionType } from '@my-hub/shared/constants';

export type Step = 'upload' | 'preview' | 'confirm';

export interface ColumnMap {
  dateCol: string;
  amountCol: string;
  twoColumn: boolean;
  debitCol: string;
  creditCol: string;
  payeeCol: string;
  notesCol: string;
  typeCol: string;
  currencyCol: string;
  categoryCol: string;
}

export interface ImportRow {
  _key: string;
  ignored: boolean;
  type: TransactionType;
  date: string; // YYYY-MM-DD, empty string if parsing failed
  rawDate: string; // original CSV value, shown in error state
  amount: number; // always positive
  csvCurrency: string; // raw value from CSV currency column (may be empty)
  rawPayeeName: string;
  rawCategoryName: string; // raw value from CSV category column (may be empty)
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  notes: string;
  isDuplicate: boolean;
}

export interface CategoryMapping {
  csvValue: string;
  categoryId: number | null;
}

export type PayeeAction = 'existing' | 'create' | 'unmapped';

export interface PayeeMapping {
  csvValue: string;
  action: PayeeAction;
  existingPayeeId: number | null;
  existingPayeeName: string | null;
  newPayeeName: string;
  addAlias: boolean;
  defaultCategoryId: number | null;
}
