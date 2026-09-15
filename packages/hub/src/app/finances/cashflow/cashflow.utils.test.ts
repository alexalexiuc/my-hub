import { describe, expect, it } from 'vitest';
import { hasAccountActivity } from './cashflow.utils';
import { AccountTypes } from '@my-hub/shared/constants';
import type { MonthlyAccountFlow } from '@/app/api/finances/reports/account-flows/account-flows.schema';

function makeFlow(overrides: Partial<MonthlyAccountFlow> = {}): MonthlyAccountFlow {
  return {
    accountId: 1,
    accountName: 'Current',
    accountType: AccountTypes.Bank,
    currency: 'EUR',
    months: [],
    totalInflows: 0,
    totalOutflows: 0,
    net: 0,
    ...overrides,
  };
}

describe('hasAccountActivity', () => {
  it('is false when nothing moved in or out', () => {
    expect(hasAccountActivity(makeFlow())).toBe(false);
  });

  it('is true when only money came in', () => {
    expect(hasAccountActivity(makeFlow({ totalInflows: 250, net: 250 }))).toBe(true);
  });

  it('is true when only money went out', () => {
    expect(hasAccountActivity(makeFlow({ totalOutflows: 80, net: -80 }))).toBe(true);
  });

  it('is true when in and out cancel each other out', () => {
    expect(hasAccountActivity(makeFlow({ totalInflows: 100, totalOutflows: 100, net: 0 }))).toBe(true);
  });
});
