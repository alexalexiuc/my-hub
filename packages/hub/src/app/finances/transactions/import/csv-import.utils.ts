import { TransactionTypes, type TransactionType } from '@my-hub/shared/constants';
import type { TransactionListItem } from '@/app/api/finances/transactions/route';
import type { ImportRow } from './types';

export function autoDetectColumn(headers: string[], patterns: RegExp[]): string {
  for (const header of headers) {
    for (const pattern of patterns) {
      if (pattern.test(header)) return header;
    }
  }
  return '';
}

export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // YYYYMMDD compact
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]!}-${compact[2]!}-${compact[3]!}`;
  const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]!}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]!}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`;
  return null;
}

export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^0-9.,-]/g, '');
  const normalized = cleaned.replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.');
  const val = parseFloat(normalized);
  return isNaN(val) ? null : val;
}

export function deriveType(signed: number, typeRaw?: string): TransactionType {
  if (typeRaw) {
    const t = typeRaw.trim().toLowerCase();
    if (t === 'transfer' || t === 'tra') return TransactionTypes.Transfer;
    if (t === 'income' || t === 'credit' || t === 'inc') return TransactionTypes.Income;
    if (t === 'expense' || t === 'debit' || t === 'exp') return TransactionTypes.Expense;
  }
  return signed >= 0 ? TransactionTypes.Income : TransactionTypes.Expense;
}

export function isDuplicateRow(row: ImportRow, existing: TransactionListItem[]): boolean {
  return existing.some(t => t.date === row.date && Math.abs(t.amount - row.amount) < 0.001 && t.type === row.type);
}

export function matchCategory(raw: string, categories: { id: number; name: string }[]): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // exact match
  let found = categories.find(c => c.name.toLowerCase() === lower);
  if (found) return found.id;
  // category name contains the raw value
  found = categories.find(c => c.name.toLowerCase().includes(lower));
  if (found) return found.id;
  // raw value contains the category name
  found = categories.find(c => lower.includes(c.name.toLowerCase()) && c.name.length > 2);
  if (found) return found.id;
  return null;
}
