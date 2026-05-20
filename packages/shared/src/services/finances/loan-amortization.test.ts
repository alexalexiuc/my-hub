import { describe, expect, it } from 'vitest';
import type { LoanAccountDetails } from '../../types';
import { calculateLoanAmortizationSummary, buildLoanSummary } from './loan-amortization';

describe('calculateLoanAmortizationSummary', () => {
  it('uses the schedule formula when no payment history is provided', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 120000,
      interestRate: 12,
      termMonths: 120,
      startDate: '2020-01-15',
    };

    const summary = calculateLoanAmortizationSummary(details, { asOfDate: '2020-04-16' });

    expect(summary.paymentsMade).toBe(3);
    expect(summary.paymentsRemaining).toBe(117);
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
      startDate: '2020-01-01',
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
      startDate: '2020-01-01',
    };

    const summary = calculateLoanAmortizationSummary(details, {
      asOfDate: '2020-06-15',
      paymentHistory: [{ amount: 300, date: '2020-02-01', currencyMismatch: true }],
    });

    expect(summary.paymentsMade).toBe(5);
    expect(summary.actualPayoffDate).toBeUndefined();
    expect(summary.interestSavedVsSchedule).toBeUndefined();
  });

  it('tracks 0% loans by reducing principal with recorded payment totals', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1000,
      interestRate: 0,
      termMonths: 10,
      startDate: '2020-01-01',
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
  const today = '2024-06-01';
  const base: LoanAccountDetails = {
    type: 'loan',
    principal: 12000,
    interestRate: 12,
    termMonths: 24,
    startDate: '2024-01-01',
  };

  it('full params: remainingPrincipal + remainingInterest === remainingObligation (±rounding)', () => {
    const summary = buildLoanSummary(base, 5, 2700, today);
    expect(summary.paramsIncomplete).toBeUndefined();
    expect(summary.remainingPrincipal).toBeDefined();
    expect(summary.remainingInterest).toBeDefined();
    expect(summary.remainingPrincipal! + summary.remainingInterest!).toBeCloseTo(summary.remainingObligation, 1);
  });

  it('missing params (null details): paramsIncomplete true, no crash, omits remainingPrincipal/Interest', () => {
    const summary = buildLoanSummary(null, 3, 300, today);
    expect(summary.paramsIncomplete).toBe(true);
    expect(summary.remainingPrincipal).toBeUndefined();
    expect(summary.remainingInterest).toBeUndefined();
    expect(summary.totalPaid).toBe(300);
    expect(summary.paymentsCompleted).toBe(3);
  });

  it('missing params (null termMonths): paramsIncomplete true', () => {
    const partial = { ...base, termMonths: null as unknown as number };
    const summary = buildLoanSummary(partial, 2, 200, today);
    expect(summary.paramsIncomplete).toBe(true);
    expect(summary.remainingPrincipal).toBeUndefined();
  });

  it('k=0: remainingPrincipal === originalPrincipal', () => {
    const summary = buildLoanSummary(base, 0, 0, today);
    expect(summary.remainingPrincipal).toBe(summary.originalPrincipal);
    expect(summary.paymentsCompleted).toBe(0);
    expect(summary.paymentsRemaining).toBe(24);
  });

  it('k=termMonths: remainingPrincipal ≈ 0', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 10000,
      interestRate: 6,
      termMonths: 36,
      startDate: '2024-01-01',
    };
    const summary = buildLoanSummary(details, 36, 0, today);
    expect(summary.remainingPrincipal).toBeCloseTo(0, 1);
    expect(summary.paymentsRemaining).toBe(0);
  });

  it('r=0: linear principal reduction', () => {
    const details: LoanAccountDetails = {
      type: 'loan',
      principal: 1200,
      interestRate: 0,
      termMonths: 12,
      startDate: '2024-01-01',
    };
    // After 4 payments: remainingPrincipal = 1200 - 4*(1200/12) = 800
    const summary = buildLoanSummary(details, 4, 400, today);
    expect(summary.remainingPrincipal).toBe(800);
    expect(summary.totalInterestScheduled).toBe(0);
    expect(summary.originalObligation).toBe(1200);
  });
});
