import { describe, expect, it } from 'vitest';
import type { FinanceAccount, LoanAccountDetails } from '../../types';
import {
  calculateLoanAmortizationSummary,
  buildLoanSummary,
  getLoanDisplayBalance,
  type LoanBalanceSnapshot,
} from './loan-amortization';

function makeLoanAccount(details: LoanAccountDetails, balance: number): FinanceAccount {
  return {
    id: 1,
    budgetId: 1,
    name: 'Loan',
    description: null,
    type: 'loan',
    currency: 'USD',
    balance,
    archived: false,
    details,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as FinanceAccount;
}

describe('calculateLoanAmortizationSummary', () => {
  it('uses the schedule formula when no payment history is provided', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 120000,
      interestRate: 12,
      termMonths: 120,
      firstPaymentDate: '2020-01-15',
    };

    const summary = calculateLoanAmortizationSummary(details, { asOfDate: '2020-04-16' });

    // Payment #1 is due on firstPaymentDate (2020-01-15) itself; by 2020-04-16 payments
    // #1-#4 are due (Jan 15, Feb 15, Mar 15, Apr 15), so 4 are made.
    expect(summary.paymentsMade).toBe(4);
    expect(summary.paymentsRemaining).toBe(116);
    expect(summary.remainingPrincipal).toBeGreaterThan(0);
    expect(summary.remainingPrincipal).toBeLessThan(details.principal);
    expect(summary.actualPayoffDate).toBeUndefined();
    expect(summary.interestSavedVsSchedule).toBeUndefined();
  });

  it('uses hybrid mode to reflect overpayments and project a faster payoff', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1000,
      interestRate: 12,
      termMonths: 12,
      firstPaymentDate: '2020-01-01',
    };

    const summary = calculateLoanAmortizationSummary(details, {
      asOfDate: '2020-06-15',
      paymentHistory: [
        { amount: 300, date: '2020-02-01' },
        { amount: 300, date: '2020-03-01' },
      ],
    });

    expect(summary.paymentsMade).toBe(2);
    expect(summary.paymentsRemaining).toBeLessThan(10);
    expect(summary.actualPayoffDate).toBeDefined();
    expect(summary.interestSavedVsSchedule).toBeGreaterThan(0);
  });

  it('falls back to schedule-only values when payment history has currency mismatch', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1000,
      interestRate: 12,
      termMonths: 12,
      firstPaymentDate: '2020-01-01',
    };

    const summary = calculateLoanAmortizationSummary(details, {
      asOfDate: '2020-06-15',
      paymentHistory: [{ amount: 300, date: '2020-02-01', currencyMismatch: true }],
    });

    // Payment #1 is due on firstPaymentDate (2020-01-01) itself, so by 2020-06-15 payments
    // #1-#6 are due (Jan 1 through Jun 1).
    expect(summary.paymentsMade).toBe(6);
    expect(summary.actualPayoffDate).toBeUndefined();
    expect(summary.interestSavedVsSchedule).toBeUndefined();
  });

  it('tracks 0% loans by reducing principal with recorded payment totals', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1000,
      interestRate: 0,
      termMonths: 10,
      firstPaymentDate: '2020-01-01',
    };

    const summary = calculateLoanAmortizationSummary(details, {
      asOfDate: '2020-06-15',
      paymentHistory: [
        { amount: 100, date: '2020-02-01' },
        { amount: 250, date: '2020-03-01' },
      ],
    });

    expect(summary.remainingPrincipal).toBe(650);
    expect(summary.totalInterestPaid).toBe(0);
    expect(summary.totalInterestRemaining).toBe(0);
  });
});

describe('buildLoanSummary', () => {
  // base loan: firstPaymentDate 2024-01-01 (payment #1 is due that day), 24 months
  // with today = '2024-06-01' → payments #1-#6 due (Jan-Jun 1st) → k=6
  const today = '2024-06-01';
  const base: LoanAccountDetails = {
    type: 'loan',
    principal: 12000,
    interestRate: 12,
    termMonths: 24,
    firstPaymentDate: '2024-01-01',
  };

  it('full params: remainingPrincipal + remainingInterest === remainingObligation (±rounding)', () => {
    const summary = buildLoanSummary(base, 2700, today);
    expect(summary.paramsIncomplete).toBeUndefined();
    expect(summary.paymentsCompleted).toBe(6);
    expect(summary.remainingPrincipal).toBeDefined();
    expect(summary.remainingInterest).toBeDefined();
    expect(summary.remainingPrincipal! + summary.remainingInterest!).toBeCloseTo(summary.remainingObligation, 1);
  });

  it('projectedPayoffDate is firstPaymentDate + (termMonths - 1) months (fixed, not derived from today)', () => {
    const summary = buildLoanSummary(base, 0, today);
    // Payment #24 (the last one) is due 23 months after payment #1 (2024-01-01).
    expect(summary.projectedPayoffDate).toBe('2025-12-01');
  });

  it('missing params (null details): paramsIncomplete true, no crash, omits remainingPrincipal/Interest', () => {
    const summary = buildLoanSummary(null, 300, today);
    expect(summary.paramsIncomplete).toBe(true);
    expect(summary.remainingPrincipal).toBeUndefined();
    expect(summary.remainingInterest).toBeUndefined();
    expect(summary.totalPaid).toBe(300);
    expect(summary.paymentsCompleted).toBe(0);
  });

  it('missing params (null termMonths): paramsIncomplete true', () => {
    const partial = { ...base, termMonths: null as unknown as number };
    const summary = buildLoanSummary(partial, 200, today);
    expect(summary.paramsIncomplete).toBe(true);
    expect(summary.remainingPrincipal).toBeUndefined();
  });

  it('k=1 when today === firstPaymentDate: payment #1 is already due', () => {
    // today == firstPaymentDate → payment #1 is due that day → k=1
    const summary = buildLoanSummary(base, 0, base.firstPaymentDate);
    expect(summary.paymentsCompleted).toBe(1);
    expect(summary.paymentsRemaining).toBe(23);
    expect(summary.remainingPrincipal).toBeLessThan(summary.originalPrincipal);
  });

  it('k=0 the day before firstPaymentDate: no payment due yet', () => {
    const summary = buildLoanSummary(base, 0, '2023-12-31');
    expect(summary.remainingPrincipal).toBe(summary.originalPrincipal);
    expect(summary.paymentsCompleted).toBe(0);
    expect(summary.paymentsRemaining).toBe(24);
  });

  it('k=termMonths when today is at end of term: remainingPrincipal ≈ 0', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 10000,
      interestRate: 6,
      termMonths: 36,
      firstPaymentDate: '2024-01-01',
    };
    // 2027-01-01 is exactly 36 months after firstPaymentDate → k=36=termMonths
    const summary = buildLoanSummary(details, 0, '2027-01-01');
    expect(summary.paymentsCompleted).toBe(36);
    expect(summary.remainingPrincipal).toBeCloseTo(0, 1);
    expect(summary.paymentsRemaining).toBe(0);
  });

  it('r=0: linear schedule-based principal reduction', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1200,
      interestRate: 0,
      termMonths: 12,
      firstPaymentDate: '2024-01-01',
    };
    // Payment #1 is due on firstPaymentDate (2024-01-01); by 2024-05-01 payments #1-#5 are due → k=5
    // remainingPrincipal = 1200 - 5*(1200/12) = 700
    const summary = buildLoanSummary(details, 400, '2024-05-01');
    expect(summary.paymentsCompleted).toBe(5);
    expect(summary.remainingPrincipal).toBe(700);
    expect(summary.totalInterestScheduled).toBe(0);
    expect(summary.originalObligation).toBe(1200);
  });
});

describe('getLoanDisplayBalance', () => {
  const interestBearingDetails: LoanAccountDetails = {
    type: 'loan',
    principal: 10000,
    interestRate: 6,
    termMonths: 60,
    firstPaymentDate: '2026-01-01',
  };

  it('returns the ledger balance unchanged for non-loan accounts (no snapshot)', () => {
    const account = makeLoanAccount(interestBearingDetails, -8800);
    expect(getLoanDisplayBalance(account, null)).toBe(-8800);
  });

  it('uses the amortization-derived remaining principal for interest-bearing loans, not the raw ledger balance', () => {
    // A $200 payment against a 6% loan is part interest, part principal, so the ledger balance
    // (which subtracts the full $200) understates the true remaining principal ($8850 vs $8800).
    const account = makeLoanAccount(interestBearingDetails, -8800);
    const snapshot: LoanBalanceSnapshot = {
      balance: 8850,
      amortizationSummary: {} as LoanBalanceSnapshot['amortizationSummary'],
    };

    expect(getLoanDisplayBalance(account, snapshot)).toBe(8850);
  });

  it('uses the negated raw ledger balance for zero-interest loans, since every payment is pure principal', () => {
    const zeroInterestDetails: LoanAccountDetails = { ...interestBearingDetails, interestRate: 0 };
    const account = makeLoanAccount(zeroInterestDetails, -8800);
    // snapshot.balance deliberately differs from -account.balance (8800) so the assertion can tell
    // the two branches apart — it must return 8800 (the negated ledger balance), not 9999.
    const snapshot: LoanBalanceSnapshot = {
      balance: 9999,
      amortizationSummary: {} as LoanBalanceSnapshot['amortizationSummary'],
    };

    expect(getLoanDisplayBalance(account, snapshot)).toBe(8800);
  });
});
