/**
 * Fixed-term deposit maths (pure — no DB, no network)
 * - getDepositMaturityDate(details) — startDate + termMonths as YYYY-MM-DD
 * - buildDepositSchedule(details) — expected payouts (gross / tax / net per date) over the term
 * - calculateDepositSummary(details, opts?) — maturity, expected interest, next unreceived payout, yield, guarantee check
 * - getOverdueDepositPayouts(details, interestReceived, opts?) — scheduled payouts past due with no matching interest received
 * - getDepositAlerts(details, interestReceived, opts?) — alerts that fire today: maturity approaching, or a payout that just became overdue
 * Types: DepositPayoutEntry, DepositSummary, DepositAlert
 *
 * Interest is simple (principal × rate × months / 12) except for `capitalized`, which compounds monthly.
 * Only `fixed` rates are exact; other rate types are computed at the stored rate and flagged `rateEstimated`.
 * The last payout absorbs rounding so the schedule sums exactly to the rounded term total.
 */
import {
  DEPOSIT_PAYOUT_INTERVAL_MONTHS,
  DepositPayouts,
  DepositRateTypes,
  type DepositStatus,
} from '../constants/finances';
import type { DepositAccountDetails } from '../types/account-details';
import { addMonthsKeepDay, currentDateString, toUTCDateStr } from './dates';
import { daysBetweenDateStr } from './weight-goal';

/** One expected interest payout. All amounts are in the deposit's currency. */
export interface DepositPayoutEntry {
  date: string;
  gross: number;
  tax: number;
  net: number;
}

/** Derived view of a deposit used by the Hub, MCP context and reports. */
export interface DepositSummary {
  maturityDate: string;
  daysToMaturity: number;
  /** 0–100, share of the term elapsed. */
  progressPercent: number;
  expectedGrossInterest: number;
  expectedTax: number;
  expectedNetInterest: number;
  interestReceivedToDate: number;
  interestRemaining: number;
  nextPayoutDate: string | null;
  nextPayoutAmount: number | null;
  /** Net interest as an annualised % of principal over the term. */
  effectiveNetYield: number;
  /** Principal plus capitalized interest exceeds `guaranteeLimit`. */
  overGuarantee: boolean;
  /** Rate is not fixed, so figures use the stored rate as an estimate. */
  rateEstimated: boolean;
  status: DepositStatus;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Returns the maturity date (YYYY-MM-DD) of a deposit: `startDate` plus `termMonths`, clamped to month end. */
export function getDepositMaturityDate(details: Pick<DepositAccountDetails, 'startDate' | 'termMonths'>): string {
  return toUTCDateStr(addMonthsKeepDay(new Date(details.startDate), details.termMonths));
}

/** Gross interest over `months` of the term: simple, or monthly-compounded for capitalized deposits. */
function grossInterest(details: DepositAccountDetails, months: number): number {
  const rate = details.interestRate / 100;
  if (details.payout === DepositPayouts.Capitalized) {
    return details.principal * (Math.pow(1 + rate / 12, months) - 1);
  }
  return (details.principal * rate * months) / 12;
}

/**
 * Builds the expected payout schedule over the whole term: one entry per payout interval
 * (monthly/quarterly/semiannual), or a single entry at maturity for `at_maturity` and `capitalized`.
 * Tax is `taxRate` % of gross. Rounding is absorbed by the last entry.
 */
export function buildDepositSchedule(details: DepositAccountDetails): DepositPayoutEntry[] {
  const { termMonths, taxRate } = details;
  if (!(termMonths > 0) || !(details.principal > 0)) return [];
  const start = new Date(details.startDate);
  const interval = DEPOSIT_PAYOUT_INTERVAL_MONTHS[details.payout];

  // Month offsets at which payouts fall due; the final one is always maturity.
  const offsets: number[] = [];
  if (interval) {
    for (let m = interval; m < termMonths; m += interval) offsets.push(m);
  }
  offsets.push(termMonths);

  const totalGross = round2(grossInterest(details, termMonths));
  const totalNet = round2(totalGross * (1 - taxRate / 100));
  let prevMonths = 0;
  let sumGross = 0;
  let sumNet = 0;

  return offsets.map((months, i) => {
    const isLast = i === offsets.length - 1;
    const gross = isLast ? round2(totalGross - sumGross) : round2(grossInterest(details, months - prevMonths));
    const net = isLast ? round2(totalNet - sumNet) : round2(gross * (1 - taxRate / 100));
    sumGross += gross;
    sumNet += net;
    prevMonths = months;
    return { date: toUTCDateStr(addMonthsKeepDay(start, months)), gross, tax: round2(gross - net), net };
  });
}

/**
 * Computes the deposit summary as of a date. `interestReceived` is the net interest already
 * logged (from transactions); it is the only non-contractual input.
 */
export function calculateDepositSummary(
  details: DepositAccountDetails,
  opts: { asOfDate?: string; interestReceived?: number } = {},
): DepositSummary {
  const asOf = opts.asOfDate ?? currentDateString();
  const received = opts.interestReceived ?? 0;
  const schedule = buildDepositSchedule(details);
  const maturityDate = getDepositMaturityDate(details);

  const expectedGross = round2(schedule.reduce((s, e) => s + e.gross, 0));
  const expectedNet = round2(schedule.reduce((s, e) => s + e.net, 0));
  // First payout not yet covered by interest received — may already be past due (then it is overdue).
  let cumulative = 0;
  const next =
    schedule.find(e => {
      cumulative += e.net;
      return cumulative - received > 0.01;
    }) ?? null;

  const totalDays = daysBetweenDateStr(details.startDate, maturityDate);
  const elapsedDays = daysBetweenDateStr(details.startDate, asOf);
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;

  const years = details.termMonths / 12;
  const capitalized = details.payout === DepositPayouts.Capitalized ? expectedNet : 0;

  return {
    maturityDate,
    daysToMaturity: Math.max(0, daysBetweenDateStr(asOf, maturityDate)),
    progressPercent: round2(progress),
    expectedGrossInterest: expectedGross,
    expectedTax: round2(expectedGross - expectedNet),
    expectedNetInterest: expectedNet,
    interestReceivedToDate: round2(received),
    interestRemaining: round2(Math.max(0, expectedNet - received)),
    nextPayoutDate: next?.date ?? null,
    nextPayoutAmount: next?.net ?? null,
    effectiveNetYield: details.principal > 0 && years > 0 ? round2((expectedNet / details.principal / years) * 100) : 0,
    overGuarantee: details.guaranteeLimit != null && details.principal + capitalized > details.guaranteeLimit,
    rateEstimated: details.rateType !== DepositRateTypes.Fixed,
    status: details.status,
  };
}

/**
 * Returns scheduled payouts that fell due more than `graceDays` ago while the interest received so
 * far does not cover them (cumulative net). Used to alert on a missed payout; empty unless active.
 */
export function getOverdueDepositPayouts(
  details: DepositAccountDetails,
  interestReceived: number,
  opts: { asOfDate?: string; graceDays?: number } = {},
): DepositPayoutEntry[] {
  if (details.status !== 'active') return [];
  const asOf = opts.asOfDate ?? currentDateString();
  const grace = opts.graceDays ?? 3;
  let cumulative = 0;
  return buildDepositSchedule(details).filter(entry => {
    cumulative = round2(cumulative + entry.net);
    return daysBetweenDateStr(entry.date, asOf) > grace && cumulative - interestReceived > 0.01;
  });
}

/** An alert that fires on a given day for a deposit. */
export type DepositAlert =
  | { kind: 'maturity'; maturityDate: string; daysToMaturity: number }
  | { kind: 'missed_payout'; payout: DepositPayoutEntry; daysOverdue: number };

/**
 * Returns the alerts that fire on `asOfDate`: one when maturity is exactly `maturityLeadDays` away
 * (default 14), and one per scheduled payout that becomes overdue on that very day (the first day past
 * the grace period, default 3 days) — so each condition alerts once, never daily. Empty for closed deposits.
 */
export function getDepositAlerts(
  details: DepositAccountDetails,
  interestReceived: number,
  opts: { asOfDate?: string; maturityLeadDays?: number; graceDays?: number } = {},
): DepositAlert[] {
  if (details.status !== 'active') return [];
  const asOf = opts.asOfDate ?? currentDateString();
  const lead = opts.maturityLeadDays ?? 14;
  const grace = opts.graceDays ?? 3;
  const alerts: DepositAlert[] = [];

  const maturityDate = getDepositMaturityDate(details);
  const daysToMaturity = daysBetweenDateStr(asOf, maturityDate);
  if (daysToMaturity === lead) alerts.push({ kind: 'maturity', maturityDate, daysToMaturity });

  for (const payout of getOverdueDepositPayouts(details, interestReceived, { asOfDate: asOf, graceDays: grace })) {
    const daysOverdue = daysBetweenDateStr(payout.date, asOf);
    if (daysOverdue === grace + 1) alerts.push({ kind: 'missed_payout', payout, daysOverdue });
  }
  return alerts;
}
