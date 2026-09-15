import type { MonthlyAccountFlow } from '@/app/api/finances/reports/account-flows/account-flows.schema';

/**
 * True when an account moved any money during the loaded window. Accounts that sat idle are
 * hidden from the By Account view so the list stays readable.
 */
export function hasAccountActivity(account: MonthlyAccountFlow): boolean {
  return account.totalInflows !== 0 || account.totalOutflows !== 0;
}
