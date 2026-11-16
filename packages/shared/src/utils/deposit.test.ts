import { describe, expect, it } from 'vitest';
import type { DepositAccountDetails } from '../types/account-details';
import {
  buildDepositSchedule,
  getDepositModeAt,
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
    expect(schedule[0]).toMatchObject({
      date: '2026-12-17',
      gross: 1333.33,
      tax: 80,
      net: 1253.33,
      capitalized: false,
    });
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
    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({ date: '2027-11-17', gross: 16_000, tax: 960, net: 15_040 });
  });

  it('compounds monthly by default when capitalized, crediting net interest', () => {
    const schedule = buildDepositSchedule({ ...micb, payout: 'capitalized' });
    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toMatchObject({ openingBalance: 200_000, closingBalance: 201_253.33, capitalized: true });
    expect(schedule[1]!.openingBalance).toBe(schedule[0]!.closingBalance);
    expect(schedule[11]!.date).toBe('2027-11-17');
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

const cap185: DepositAccountDetails = {
  ...micb,
  principal: 185_000,
  payout: 'capitalized',
  capitalizationFrequency: 'monthly',
};

describe('capitalized schedule', () => {
  it('185,000 MDL at 8% for 12 months, monthly, 6% tax grows to about 199,400', () => {
    const s = calculateDepositSummary({ ...cap185, guaranteeLimit: 200_000 }, { asOfDate: '2026-11-17' });
    expect(s.projectedMaturityBalance).toBeCloseTo(185_000 * Math.pow(1 + (0.08 * 0.94) / 12, 12), -1);
    expect(s.projectedMaturityBalance).toBeGreaterThan(199_390);
    expect(s.projectedMaturityBalance).toBeLessThan(199_410);
    expect(s.overGuarantee).toBe(false);
  });

  it('200,000 MDL goes over the guarantee at the first capitalization', () => {
    const s = calculateDepositSummary(
      { ...micb, payout: 'capitalized', capitalizationFrequency: 'monthly', guaranteeLimit: 200_000 },
      { asOfDate: '2026-11-17' },
    );
    expect(s.projectedMaturityBalance).toBeGreaterThan(215_560);
    expect(s.projectedMaturityBalance).toBeLessThan(215_580);
    expect(s.overGuarantee).toBe(true);
    expect(s.guaranteeBreachDate).toBe('2026-12-17');
    expect(s.maxPrincipalWithinGuarantee).toBeGreaterThan(185_540);
    expect(s.maxPrincipalWithinGuarantee).toBeLessThan(185_570);
  });

  it('capitalizes quarterly and at maturity', () => {
    const q = buildDepositSchedule({ ...cap185, capitalizationFrequency: 'quarterly' });
    expect(q.map(e => e.date)).toEqual(['2027-02-17', '2027-05-17', '2027-08-17', '2027-11-17']);
    const m = buildDepositSchedule({ ...cap185, capitalizationFrequency: 'at_maturity' });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ gross: 14_800, net: 13_912, capitalized: true });
  });

  it('keeps the guarantee check on principal for paid-out deposits', () => {
    const s = calculateDepositSummary({ ...micb, guaranteeLimit: 150_000 }, { asOfDate: '2026-11-17' });
    expect(s.overGuarantee).toBe(true);
    expect(s.guaranteeBreachDate).toBe('2026-11-17');
    expect(s.maxPrincipalWithinGuarantee).toBe(150_000);
  });

  it('computes the capitalization delta, shrinking with a reinvestment rate', () => {
    const plain = calculateDepositSummary(cap185, { asOfDate: '2026-11-17' });
    expect(plain.capitalizationDelta).toBeGreaterThan(0);
    const reinvested = calculateDepositSummary(cap185, { asOfDate: '2026-11-17', reinvestRate: 2 });
    expect(reinvested.capitalizationDelta).toBeLessThan(plain.capitalizationDelta);
  });
});

describe('mode change mid-term', () => {
  const switched: DepositAccountDetails = {
    ...micb,
    payout: 'capitalized',
    capitalizationFrequency: 'monthly',
    modeEffectiveDate: '2027-02-17',
    modeHistory: [{ from: '2026-11-17', payout: 'monthly' }],
  };

  it('keeps earlier periods as payouts and capitalizes only from the effective date', () => {
    const schedule = buildDepositSchedule(switched);
    expect(schedule).toHaveLength(12);
    expect(schedule.slice(0, 3).every(e => !e.capitalized && e.closingBalance === 200_000)).toBe(true);
    expect(schedule[3]).toMatchObject({ date: '2027-03-17', capitalized: true, openingBalance: 200_000 });
    expect(schedule[4]!.openingBalance).toBeGreaterThan(200_000);
    expect(schedule.slice(0, 3)).toEqual(buildDepositSchedule(micb).slice(0, 3));
  });

  it('resolves the mode in force on a date', () => {
    expect(getDepositModeAt(switched, '2027-02-17').payout).toBe('monthly');
    expect(getDepositModeAt(switched, '2027-03-17').payout).toBe('capitalized');
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
    ).toBe(true); // capitalized interest pushes the projected balance over the limit
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
