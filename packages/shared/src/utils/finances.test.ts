import { describe, expect, it } from 'vitest';
import { AccountTypes, LentDirections } from '../constants/finances';
import { isLiabilityAccount } from './finances';

describe('isLiabilityAccount', () => {
  it('treats loans and credit cards as liabilities', () => {
    expect(isLiabilityAccount(AccountTypes.Loan)).toBe(true);
    expect(isLiabilityAccount(AccountTypes.CreditCard)).toBe(true);
  });

  it('treats ordinary asset accounts as assets', () => {
    expect(isLiabilityAccount(AccountTypes.Bank)).toBe(false);
    expect(isLiabilityAccount(AccountTypes.Investment)).toBe(false);
  });

  it('treats money lent as an asset', () => {
    expect(isLiabilityAccount(AccountTypes.BorrowedLent, LentDirections.Gave)).toBe(false);
  });

  it('treats money borrowed as a liability', () => {
    expect(isLiabilityAccount(AccountTypes.BorrowedLent, LentDirections.Received)).toBe(true);
  });

  it('treats a Borrowed/Lent account without a direction as an asset', () => {
    expect(isLiabilityAccount(AccountTypes.BorrowedLent, null)).toBe(false);
    expect(isLiabilityAccount(AccountTypes.BorrowedLent)).toBe(false);
  });
});
