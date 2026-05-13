import { describe, expect, it } from 'vitest';
import type { LoanAccountDetails } from '../../types';
import { calculateLoanAmortizationSummary } from './loan-amortization';

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
