import { AccountItem } from '@/app/api/finances/accounts/route';
import { SupportedCurrency } from '@my-hub/shared/constants';

export function groupAccountsByCurrency(accounts: AccountItem[]): [SupportedCurrency, AccountItem[]][] {
  const groups: Record<SupportedCurrency, AccountItem[]> = {} as Record<SupportedCurrency, AccountItem[]>;
  for (const account of accounts) {
    const { currency } = account;
    if (!groups[currency]) groups[currency] = [];
    groups[currency].push(account);
  }
  return Object.entries(groups) as [SupportedCurrency, AccountItem[]][];
}
