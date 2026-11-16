import { describe, expect, it } from 'vitest';
import type { DepositAccountDetails } from '../types/account-details';
import {
  buildDepositSchedule,
  calculateDepositSummary,
  getDepositAlerts,
  getDepositMaturityDate,
  getOverdueDepositPayouts,
} from './deposit';

const micb: DepositAccountDetails = {
  type: 'deposit',
  institution: 'MICB',
  productName: 'Maestro Online',
  instrument: 'bank_deposit',
  principal: 200_000,
  interestRate: 8,
  rateType: 'fixed',
  startDate: '2026-11-17',
  termMonths: 12,
  payout: 'monthly',
  payoutAccountId: 1,
  taxRate: 6,
  status: 'active',
};

describe('getDepositMaturityDate', () => {
  it('adds the term to the start date', () => {
    expect(getDepositMaturityDate(micb)).toBe('2027-11-17');
  });
  it('clamps to month end', () => {
    expect(getDepositMaturityDate({ startDate: '2026-08-31', termMonths: 6 })).toBe('2027-02-28');
  });
});

describe('buildDepositSchedule', () => {
  it('builds 12 monthly payouts that sum to the exact term totals (MICB example)', () => {
    const schedule = buildDepositSchedule(micb);
    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toEqual({ date: '2026-12-17', gross: 1333.33, tax: 80, net: 1253.33 });
    expect(schedule[11]!.date).toBe('2027-11-17');
    expect(Math.round(schedule.reduce((s, e) => s + e.gross, 0) * 100) / 100).toBe(16_000);
    expect(Math.round(schedule.reduce((s, e) => s + e.net, 0) * 100) / 100).toBe(15_040);
  });

  it('pays quarterly', () => {
    const schedule = buildDepositSchedule({ ...micb, payout: 'quarterly' });
    expect(schedule.map(e => e.date)).toEqual(['2027-02-17', '2027-05-17', '2027-08-17', '2027-11-17']);
    expect(schedule[0]!.gross).toBe(4000);
  });

  it('pays everything at maturity', () => {
    const schedule = buildDepositSchedule({ ...micb, payout: 'at_maturity' });
    expect(schedule).toEqual([{ date: '2027-11-17', gross: 16_000, tax: 960, net: 15_040 }]);
  });

  it('compounds monthly when capitalized', () => {
    const [entry] = buildDepositSchedule({ ...micb, payout: 'capitalized' });
    expect(entry!.gross).toBeGreaterThan(16_000);
    expect(entry!.date).toBe('2027-11-17');
  });

  it('applies no tax for a zero tax rate', () => {
    const [entry] = buildDepositSchedule({ ...micb, payout: 'at_maturity', taxRate: 0 });
    expect(entry!.tax).toBe(0);
    expect(entry!.net).toBe(16_000);
  });

  it('returns nothing for an invalid term', () => {
    expect(buildDepositSchedule({ ...micb, termMonths: 0 })).toEqual([]);
  });
});

describe('calculateDepositSummary', () => {
  it('summarises a deposit part-way through', () => {
    const s = calculateDepositSummary(micb, { asOfDate: '2027-02-20', interestReceived: 3760 });
    expect(s.maturityDate).toBe('2027-11-17');
    expect(s.daysToMaturity).toBe(270);
    expect(s.expectedNetInterest).toBe(15_040);
    expect(s.expectedTax).toBe(960);
    expect(s.interestRemaining).toBe(11_280);
    expect(s.nextPayoutDate).toBe('2027-03-17');
    expect(s.effectiveNetYield).toBe(7.52);
    expect(s.overGuarantee).toBe(false);
    expect(s.rateEstimated).toBe(false);
  });

  it('points next payout at the first one not yet received, even when past due', () => {
    const s = calculateDepositSummary(micb, { asOfDate: '2027-02-20', interestReceived: 1253.33 });
    expect(s.nextPayoutDate).toBe('2027-01-17');
    expect(s.nextPayoutAmount).toBe(1253.33);
  });

  it('clamps progress and days after maturity and has no next payout', () => {
    const s = calculateDepositSummary(micb, { asOfDate: '2028-01-01', interestReceived: 15_040 });
    expect(s.daysToMaturity).toBe(0);
    expect(s.progressPercent).toBe(100);
    expect(s.nextPayoutDate).toBeNull();
    expect(s.interestRemaining).toBe(0);
  });

  it('flags principal over the guarantee limit, including capitalized interest', () => {
    expect(
      calculateDepositSummary({ ...micb, guaranteeLimit: 200_000 }, { asOfDate: '2026-11-17' }).overGuarantee,
    ).toBe(false);
    expect(
      calculateDepositSummary({ ...micb, payout: 'capitalized', guaranteeLimit: 200_000 }, { asOfDate: '2026-11-17' })
        .overGuarantee,
    ).toBe(true);
  });

  it('marks non-fixed rates as estimated', () => {
    expect(calculateDepositSummary({ ...micb, rateType: 'floating' }, { asOfDate: '2026-12-01' }).rateEstimated).toBe(
      true,
    );
  });
});

describe('getOverdueDepositPayouts', () => {
  it('reports payouts past the grace period that are not covered by received interest', () => {
    const overdue = getOverdueDepositPayouts(micb, 1253.33, { asOfDate: '2027-02-25' });
    expect(overdue.map(e => e.date)).toEqual(['2027-01-17', '2027-02-17']);
  });
  it('respects the grace window', () => {
    expect(getOverdueDepositPayouts(micb, 0, { asOfDate: '2026-12-19' })).toEqual([]);
  });
  it('is empty when interest is fully logged', () => {
    expect(getOverdueDepositPayouts(micb, 2506.66, { asOfDate: '2027-02-10' })).toEqual([]);
  });
  it('is empty for closed deposits', () => {
    expect(getOverdueDepositPayouts({ ...micb, status: 'matured' }, 0, { asOfDate: '2027-12-01' })).toEqual([]);
  });
});

describe('getDepositAlerts', () => {
  it('alerts exactly 14 days before maturity', () => {
    expect(getDepositAlerts(micb, 15_040, { asOfDate: '2027-11-03' })).toEqual([
      { kind: 'maturity', maturityDate: '2027-11-17', daysToMaturity: 14 },
    ]);
    expect(getDepositAlerts(micb, 15_040, { asOfDate: '2027-11-04' })).toEqual([]);
  });

  it('alerts once on the day a payout becomes overdue', () => {
    const alerts = getDepositAlerts(micb, 0, { asOfDate: '2026-12-21' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'missed_payout', daysOverdue: 4 });
    expect(getDepositAlerts(micb, 0, { asOfDate: '2026-12-22' })).toEqual([]);
  });

  it('does not alert when the payout was logged or the deposit is closed', () => {
    expect(getDepositAlerts(micb, 1253.33, { asOfDate: '2026-12-21' })).toEqual([]);
    expect(getDepositAlerts({ ...micb, status: 'broken' }, 0, { asOfDate: '2026-12-21' })).toEqual([]);
  });
});
