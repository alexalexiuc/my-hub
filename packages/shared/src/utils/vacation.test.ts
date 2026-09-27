import { describe, expect, it } from 'vitest';
import {
  classifyVacationDay,
  createVacationModel,
  vacationHorizonError,
  vacationRangeError,
  type VacationModelInput,
  type VacationRuleInput,
} from './vacation';

// Labour Code art. 111 non-working holidays for 2026 (Easter 12 Apr, Blajini 20 Apr).
const MD_2026 = [
  '2026-01-01',
  '2026-01-07',
  '2026-01-08',
  '2026-03-08',
  '2026-04-12',
  '2026-04-13',
  '2026-04-20',
  '2026-05-01',
  '2026-05-09',
  '2026-06-01',
  '2026-08-27',
  '2026-08-31',
  '2026-12-25',
].map(date => ({ date, kind: 'holiday' as const, name: 'Holiday' }));

const CURRENT: VacationRuleInput = {
  id: 1,
  name: 'MD current',
  region: null,
  validFrom: '2004-01-01',
  validTo: '2026-12-31',
  leaveUnit: 'calendar',
  annualEntitlementDays: 28,
  avgWindowMonths: 3,
  rateBasis: 'calendar_day',
  raiseResetsWindow: true,
  status: 'active',
};

const REFORM: VacationRuleInput = {
  id: 2,
  name: 'MD 2027 draft',
  region: null,
  validFrom: '2027-01-01',
  validTo: null,
  leaveUnit: 'working',
  annualEntitlementDays: 22,
  avgWindowMonths: 3,
  rateBasis: 'working_day',
  raiseResetsWindow: true,
  status: 'draft',
};

const monthly = (from: number, to: number, baseMdl: number, year = 2026) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    month: `${year}-${String(from + i).padStart(2, '0')}`,
    baseMdl,
    extraMdl: 0,
    kind: 'actual' as const,
  }));

function model(overrides: Partial<VacationModelInput> = {}) {
  return createVacationModel({
    openingBalanceDays: 10,
    openingBalanceDate: '2026-01-31',
    accrualStart: null,
    ruleSets: [CURRENT],
    taxRegimes: [{ validFrom: '2020-01-01', validTo: null, medicalRate: 0, incomeTaxRate: 0 }],
    salaries: monthly(1, 12, 30000),
    holidays: MD_2026,
    leavePeriods: [],
    includeDraftRules: false,
    includePlanned: true,
    ...overrides,
  });
}

// Window for leave starting May 2026 = Feb, Mar, Apr 2026:
//   Feb: 20 working days, 28 calendar days, 0 holidays
//   Mar: 22 working days, 31 calendar days, 1 holiday (8 Mar, a Sunday)
//   Apr: 20 working days, 30 calendar days, 3 holidays (12 Sun, 13 Mon, 20 Mon)
// Σ working = 62, Σ (calendar − holidays) = 28 + 30 + 27 = 85.
// May 2026 has 20 working days (21 weekdays minus 1 May), so a May workday is worth 30000 / 20 = 1500.

describe('classifyVacationDay', () => {
  const map = new Map([
    ['2026-05-09', { date: '2026-05-09', kind: 'holiday' as const, name: 'Victory Day' }],
    ['2026-05-04', { date: '2026-05-04', kind: 'transferred_off' as const, name: 'Transfer' }],
    ['2026-05-16', { date: '2026-05-16', kind: 'transferred_workday' as const, name: 'Transfer' }],
  ]);

  it('keeps a weekend holiday a holiday', () => {
    expect(classifyVacationDay('2026-05-09', map)).toEqual({ kind: 'holiday', markers: ['weekend', 'holiday'] });
  });

  it('treats transferred days as rest days and working Saturdays as workdays', () => {
    expect(classifyVacationDay('2026-05-04', map).kind).toBe('rest');
    expect(classifyVacationDay('2026-05-16', map).kind).toBe('workday');
    expect(classifyVacationDay('2026-05-17', map).kind).toBe('rest');
    expect(classifyVacationDay('2026-05-05', map).kind).toBe('workday');
  });
});

describe('rateFor (HG 426 average daily salary)', () => {
  it('computes the calendar-day rate over the 3 months before the start month', () => {
    const rate = model().rateFor('2026-05-11')!;
    expect(rate.windowMonths).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(rate.workingDayRate).toBeCloseTo(90000 / 62, 6);
    expect(rate.calendarDayRate).toBeCloseTo(90000 / 85, 6); // 1058.82
    expect(rate.rateGross).toBeCloseTo(90000 / 85, 6);
  });

  it('matches the published worked example (31 000 lei, 60 working days, 90 calendar days)', () => {
    // delucru.md: 31000 / 60 × 60 / 90 = 344.44 per calendar day → 28 days = 9644.44.
    const perDay = ((31000 / 60) * 60) / 90;
    expect(Math.round(perDay * 28 * 100) / 100).toBe(9644.44);
  });

  it('subtracts leave days from days worked without dropping the month', () => {
    const rate = model({
      leavePeriods: [{ id: 1, startDate: '2026-03-16', endDate: '2026-03-20', status: 'taken' }],
    }).rateFor('2026-05-11')!;
    const earnings = 30000 + (30000 * 17) / 22 + 30000;
    expect(rate.workingDayRate).toBeCloseTo(earnings / 57, 6);
    expect(rate.calendarDayRate).toBeCloseTo(((earnings / 57) * 62) / 85, 6);
  });

  it('counts bonuses attributed to a window month', () => {
    const salaries = monthly(1, 12, 30000).map(s => (s.month === '2026-03' ? { ...s, extraMdl: 8500 } : s));
    expect(model({ salaries }).rateFor('2026-05-11')!.calendarDayRate).toBeCloseTo(98500 / 85, 6);
  });

  it('restarts the window at a base raise inside it', () => {
    const m = model({ salaries: [...monthly(1, 2, 30000), ...monthly(3, 12, 36000)] });
    const rate = m.rateFor('2026-05-11')!;
    expect(rate.windowMonths).toEqual(['2026-03', '2026-04']);
    expect(rate.calendarDayRate).toBeCloseTo(72000 / 57, 6);
    expect(m.warnings().some(w => w.includes('rose in 2026-03'))).toBe(true);
  });

  it('keeps the full window when the rule set does not reset on raises', () => {
    const rate = model({
      ruleSets: [{ ...CURRENT, raiseResetsWindow: false }],
      salaries: [...monthly(1, 2, 30000), ...monthly(3, 12, 36000)],
    }).rateFor('2026-05-11')!;
    expect(rate.calendarDayRate).toBeCloseTo(102000 / 85, 6);
  });

  it('carries a projected base forward and warns', () => {
    const m = model({ salaries: [{ month: '2026-01', baseMdl: 30000, extraMdl: 0, kind: 'projected' }] });
    expect(m.rateFor('2026-05-11')!.calendarDayRate).toBeCloseTo(90000 / 85, 6);
    expect(m.warnings().some(w => w.startsWith('No salary for 2026-02'))).toBe(true);
  });

  it('leaves out months before employment started', () => {
    const rate = model({ salaries: monthly(4, 12, 30000) }).rateFor('2026-05-11')!;
    expect(rate.windowMonths).toEqual(['2026-04']);
    expect(rate.calendarDayRate).toBeCloseTo(30000 / 27, 6);
  });
});

describe('calendar', () => {
  const cdr = 90000 / 85;
  const [row, ...rest] = model().calendar('2026-05-08', '2026-05-11').rows;
  const byDate = Object.fromEntries([row!, ...rest].map(r => [r[0], r]));

  it('prices a workday against the pay forgone that day', () => {
    expect(byDate['2026-05-08']).toEqual(['2026-05-08', round2(cdr - 1500), round2(cdr), 1, []]);
  });

  it('pays a weekend at the full rate and charges one balance day', () => {
    expect(byDate['2026-05-10']).toEqual(['2026-05-10', round2(cdr), round2(cdr), 1, ['weekend']]);
  });

  it('neither pays nor charges a public holiday', () => {
    expect(byDate['2026-05-09']).toEqual(['2026-05-09', 0, 0, 0, ['weekend', 'holiday']]);
  });

  it('applies AOAM and income tax multiplicatively under the standard regime', () => {
    const m = model({
      taxRegimes: [{ validFrom: '2020-01-01', validTo: null, medicalRate: 0.09, incomeTaxRate: 0.12 }],
    });
    const [, delta, amount] = m.calendar('2026-05-11', '2026-05-11').rows[0]!;
    expect(amount).toBeCloseTo(round2(cdr * 0.91 * 0.88), 2);
    expect(delta).toBeCloseTo(round2((cdr - 1500) * 0.8008), 2);
  });

  it('warns and reports gross when no tax regime applies', () => {
    const m = model({ taxRegimes: [] });
    m.calendar('2026-05-11', '2026-05-11');
    expect(m.warnings()).toContain('No tax regime covers 2026-05-11; amounts are gross.');
  });
});

describe('evaluateSpan', () => {
  it('totals a Monday–Sunday leave that contains a Saturday holiday', () => {
    const cdr = 90000 / 85;
    const span = model().evaluateSpan('2026-05-04', '2026-05-10');
    expect(span.calendarDays).toBe(7);
    expect(span.workdays).toBe(5);
    expect(span.balanceCost).toBe(6); // 9 May does not count
    expect(span.amountNet).toBeCloseTo(round2(6 * cdr), 2);
    expect(span.deltaNet).toBeCloseTo(round2(6 * cdr - 5 * 1500), 2);
    // 1 May (Fri holiday) + weekend 2–3 May lead into it; Monday 11 May is a workday.
    expect(span).toMatchObject({ restFrom: '2026-05-01', restTo: '2026-05-10', restDays: 10 });
  });

  it('fixes the rate by the start month when a span crosses into the next month', () => {
    const m = model({ salaries: [...monthly(1, 4, 30000), ...monthly(5, 12, 40000)] });
    const span = m.evaluateSpan('2026-04-27', '2026-05-03'); // rate from Jan–Mar, all at 30000
    const aprilRate = m.rateFor('2026-04-27')!;
    expect(aprilRate.windowMonths).toEqual(['2026-01', '2026-02', '2026-03']);
    // Charged: 27–30 Apr, 2–3 May (1 May is a holiday) = 6 days at the April rate.
    expect(span.balanceCost).toBe(6);
    expect(span.amountNet).toBeCloseTo(round2(6 * aprilRate.calendarDayRate), 2);
    // Pay forgone: 27–30 Apr at 30000/20 (April has 20 working days); no May workdays.
    expect(span.deltaNet).toBeCloseTo(round2(6 * aprilRate.calendarDayRate - 4 * 1500), 2);
  });
});

describe('balanceOn', () => {
  it('accrues 28/365 a day after the opening date and charges taken leave in calendar days', () => {
    const m = model({ leavePeriods: [{ id: 1, startDate: '2026-03-16', endDate: '2026-03-22', status: 'taken' }] });
    // 59 days of accrual (1 Feb – 31 Mar), 7 calendar days of leave (Mon–Sun, no holiday).
    expect(m.balanceOn('2026-03-31').totalDays).toBeCloseTo(round2(10 + (59 * 28) / 365 - 7), 2);
  });

  it('ignores planned leave when asked to', () => {
    const leavePeriods = [{ id: 1, startDate: '2026-03-16', endDate: '2026-03-22', status: 'planned' as const }];
    const withPlanned = model({ leavePeriods }).balanceOn('2026-03-31').totalDays;
    const without = model({ leavePeriods, includePlanned: false }).balanceOn('2026-03-31').totalDays;
    expect(round2(without - withPlanned)).toBe(7);
  });

  it('spends the old calendar-day bucket first, then the working-day bucket', () => {
    const m = model({
      openingBalanceDays: 2,
      openingBalanceDate: '2026-12-31',
      ruleSets: [CURRENT, REFORM],
      includeDraftRules: true,
      holidays: [],
      salaries: monthly(1, 12, 30000).concat(monthly(1, 12, 30000, 2027)),
      leavePeriods: [{ id: 1, startDate: '2027-01-04', endDate: '2027-01-10', status: 'taken' }],
    });
    const balance = m.balanceOn('2027-01-10');
    const accrued = (10 * 22) / 365; // 1–10 Jan under the reform
    // Mon 4 + Tue 5 drain the calendar bucket; Wed–Fri cost 3 working days; the weekend costs nothing.
    expect(balance.buckets).toEqual([
      { ruleSetId: 1, ruleSetName: 'MD current', leaveUnit: 'calendar', days: 0 },
      { ruleSetId: 2, ruleSetName: 'MD 2027 draft', leaveUnit: 'working', days: round2(accrued - 3) },
    ]);
  });

  it('extends the current law past its end when the draft is excluded', () => {
    const m = model({ ruleSets: [CURRENT, REFORM], openingBalanceDate: '2026-12-31', openingBalanceDays: 0 });
    expect(m.balanceOn('2027-12-31').totalDays).toBeCloseTo(28, 1);
    expect(m.warnings().some(w => w.includes('is extended'))).toBe(true);
  });
});

describe('findBestWindows', () => {
  const m = model();
  const search = { from: '2026-04-06', to: '2026-05-31', top: 3 };

  it('returns non-overlapping spans that spend exactly the requested balance', () => {
    const spans = m.findBestWindows({ ...search, leaveDays: 5, objective: 'max_rest' });
    expect(spans).toHaveLength(3);
    for (const s of spans) expect(s.balanceCost).toBe(5);
    for (let i = 1; i < spans.length; i++) expect(spans[i - 1]!.restDays).toBeGreaterThanOrEqual(spans[i]!.restDays);
    const [a, b] = spans;
    expect(a!.endDate < b!.startDate || b!.endDate < a!.startDate).toBe(true);
  });

  it('ranks by money, which favours spans that include paid weekends', () => {
    const [best] = m.findBestWindows({ ...search, leaveDays: 5, objective: 'max_money' });
    const all = m.findBestWindows({ ...search, leaveDays: 5, objective: 'max_money', top: 50 });
    expect(best!.deltaNet).toBe(Math.max(...all.map(s => s.deltaNet)));
  });

  it('finds the cheapest leave for a wanted stretch of time off', () => {
    const [best] = m.findBestWindows({ ...search, restDays: 10, objective: 'min_balance' });
    // 1–10 May: holiday Friday + weekend lead in, so leave 4–8 May (+ the Sunday) costs 6.
    expect(best!.balanceCost).toBeLessThanOrEqual(6);
    expect(best!.restDays).toBeGreaterThanOrEqual(10);
  });

  it('skips spans that overlap existing leave', () => {
    const busy = model({
      leavePeriods: [{ id: 1, startDate: '2026-04-06', endDate: '2026-05-24', status: 'planned' }],
    });
    const spans = busy.findBestWindows({ ...search, leaveDays: 3, objective: 'max_money' });
    for (const s of spans) expect(s.startDate > '2026-05-24').toBe(true);
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

describe('query guards', () => {
  it('rejects impossible dates and inverted or oversized ranges', () => {
    expect(vacationRangeError('2026-13-01', '2026-12-31')).toBe('2026-13-01 is not a valid YYYY-MM-DD date.');
    expect(vacationRangeError('2026-05-10', '2026-05-01')).toMatch(/before its start/);
    expect(vacationRangeError('2026-01-01', '2027-12-31')).toMatch(/longer than 366 days/);
    expect(vacationRangeError('2026-01-01', '2026-12-31')).toBeNull();
  });

  it('caps how far past the opening balance date a query may look', () => {
    expect(vacationHorizonError('2026-01-31', '2046-01-31')).toBeNull();
    expect(vacationHorizonError('2026-01-31', '2046-02-01')).toMatch(/more than 20 years/);
    expect(vacationHorizonError('2026-01-31', '9999-12-31')).not.toBeNull();
  });
});
