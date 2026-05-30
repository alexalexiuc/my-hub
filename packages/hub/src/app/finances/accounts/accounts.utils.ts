import type { AccountItem } from '@/app/api/finances/accounts/route';
import type { SupportedCurrency } from '@my-hub/shared/constants';

export const ACCOUNT_GROUPS = [
  { key: 'bank', label: 'Bank' },
  { key: 'cash', label: 'Cash' },
  { key: 'credit_card', label: 'Credit Cards' },
  { key: 'goal', label: 'Goals' },
  { key: 'loan', label: 'Loans' },
  { key: 'borrowed_lent', label: 'Borrowed/Lent' },
  { key: 'investment', label: 'Investments' },
  { key: 'tracking', label: 'Tracking' },
] as const;

const ACCOUNT_TYPE_ORDER: ReadonlyArray<string> = ACCOUNT_GROUPS.map(g => g.key);

export function sortAccountsByGroup<T extends { type: string }>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => {
    const ai = ACCOUNT_TYPE_ORDER.indexOf(a.type);
    const bi = ACCOUNT_TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export function groupAccountsByCurrency(accounts: AccountItem[]): [SupportedCurrency, AccountItem[]][] {
  const groups: Record<SupportedCurrency, AccountItem[]> = {} as Record<SupportedCurrency, AccountItem[]>;
  for (const account of accounts) {
    const { currency } = account;
    if (!groups[currency]) groups[currency] = [];
    groups[currency].push(account);
  }
  return Object.entries(groups) as [SupportedCurrency, AccountItem[]][];
}
