/**
 * Fixed-term deposit maths (pure — no DB, no network)
 * - getDepositMaturityDate(details) — startDate + termMonths as YYYY-MM-DD
 * - buildDepositSchedule(details) — expected payouts (gross / tax / net per date) over the term
 * - calculateDepositSummary(details, opts?) — maturity, expected interest, next unreceived payout, yield, guarantee check
 * - getDepositModeSegments(details) — the payout/capitalization modes over the term, with their date ranges
 * - getDepositModeAt(details, date) — the mode in force on a date
 * - getOverdueDepositPayouts(details, interestReceived, opts?) — scheduled payouts past due with no matching interest received
 * - getDepositAlerts(details, interestReceived, opts?) — alerts that fire today: maturity approaching, or a payout that just became overdue
 * Types: DepositPayoutEntry, DepositSummary, DepositAlert
 *
 * Interest accrues on the deposit balance (balance × rate × period). Paid-out interest leaves the balance
 * unchanged; capitalized interest is credited NET of tax at every capitalization and earns interest from then on
 * (final balance = principal × (1 + r·(1−tax)/n)^periods). A mid-term mode change splits the term into segments;
 * earlier segments keep their mode. Only `fixed` rates are exact; other rate types use the stored rate and are
 * flagged `rateEstimated`. The last paid-out entry absorbs rounding so payouts sum exactly to the rounded total.
 */
import {
  DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY,
  DEPOSIT_CAPITALIZATION_INTERVAL_MONTHS,
  DEPOSIT_PAYOUT_INTERVAL_MONTHS,
  DepositCapitalizationFrequencies,
  DepositPayouts,
  DepositRateTypes,
  type DepositStatus,
} from '../constants/finances';
import type { DepositAccountDetails, DepositModeSegment } from '../types/account-details';
import { addMonthsKeepDay, currentDateString, toUTCDateStr } from './dates';
import { daysBetweenDateStr } from './weight-goal';

/** One schedule period: interest paid out, or credited to the deposit when `capitalized`. Amounts are in the deposit's currency. */
export interface DepositPayoutEntry {
  date: string;
  gross: number;
  tax: number;
  net: number;
  /** Net interest is credited to the deposit itself (not paid out). */
  capitalized: boolean;
  /** Deposit balance before this period's interest. */
  openingBalance: number;
  /** Deposit balance after this period (opening + net when capitalized, else unchanged). */
  closingBalance: number;
}

/** A payout/capitalization mode and the date range it covers (`from` exclusive of earlier modes, `to` = next change or maturity). */
export interface DepositModeRange extends DepositModeSegment {
  to: string;
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
  /** Balance at maturity according to the schedule: principal plus capitalized net interest. */
  projectedMaturityBalance: number;
  /** The projected maturity balance exceeds `guaranteeLimit`. */
  overGuarantee: boolean;
  /** First schedule date on which the balance is over `guaranteeLimit` (the start date if the principal already is); null when never. */
  guaranteeBreachDate: string | null;
  /** Largest principal that stays within `guaranteeLimit` at maturity (limit ÷ growth factor); null without a limit. */
  maxPrincipalWithinGuarantee: number | null;
  /** Extra net interest from capitalizing compared with paying interest out at the same cadence (after reinvesting payouts at `reinvestRate`). */
  capitalizationDelta: number;
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

/**
 * Year fraction between two dates: whole months / 12 when `to` is an exact month anniversary of `from`,
 * otherwise days / 365 (a period cut short by a mode change or maturity).
 */
function yearFraction(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (months > 0 && toUTCDateStr(addMonthsKeepDay(a, months)) === to) return months / 12;
  return daysBetweenDateStr(from, to) / 365;
}

/**
 * Returns the deposit's payout/capitalization modes in date order with the range each covers: earlier modes
 * from `modeHistory`, then the current one from `modeEffectiveDate` (or the start date) to maturity.
 */
export function getDepositModeSegments(details: DepositAccountDetails): DepositModeRange[] {
  const history = details.modeHistory ?? [];
  const currentFrom = history.length > 0 ? (details.modeEffectiveDate ?? details.startDate) : details.startDate;
  const modes: DepositModeSegment[] = [
    ...history,
    { from: currentFrom, payout: details.payout, capitalizationFrequency: details.capitalizationFrequency },
  ];
  const maturity = getDepositMaturityDate(details);
  return modes.map((m, i) => ({ ...m, to: modes[i + 1]?.from ?? maturity })).filter(m => m.from < m.to);
}

/** Returns the mode in force for interest dated `date` (a payout on a change date still belongs to the earlier mode). */
export function getDepositModeAt(details: DepositAccountDetails, date: string): DepositModeRange {
  const segments = getDepositModeSegments(details);
  return (
    segments.find(seg => date > seg.from && date <= seg.to) ??
    (date <= segments[0]!.from ? segments[0]! : segments.at(-1)!)
  );
}

function modeIntervalMonths(seg: DepositModeSegment): number | null {
  return seg.payout === DepositPayouts.Capitalized
    ? DEPOSIT_CAPITALIZATION_INTERVAL_MONTHS[seg.capitalizationFrequency ?? DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY]
    : DEPOSIT_PAYOUT_INTERVAL_MONTHS[seg.payout];
}

/**
 * Builds the expected schedule over the whole term. Each mode segment is cut into periods
 * (monthly/quarterly/semiannual payout, or the capitalization frequency; one period per segment for
 * `at_maturity`). Interest accrues on the running balance; tax is `taxRate` % of gross. Capitalized
 * periods credit net interest to the balance; paid-out periods leave it unchanged. Each entry carries
 * opening and closing balance. Rounding of paid-out entries is absorbed by the last one.
 */
export function buildDepositSchedule(details: DepositAccountDetails): DepositPayoutEntry[] {
  const { termMonths, taxRate } = details;
  if (!(termMonths > 0) || !(details.principal > 0)) return [];
  const rate = details.interestRate / 100;
  const keep = 1 - taxRate / 100;

  const entries: DepositPayoutEntry[] = [];
  let balance = details.principal;
  let paidExactGross = 0;

  for (const seg of getDepositModeSegments(details)) {
    const interval = modeIntervalMonths(seg);
    const capitalized = seg.payout === DepositPayouts.Capitalized;
    const boundaries: string[] = [];
    if (interval) {
      for (let m = interval; ; m += interval) {
        const d = toUTCDateStr(addMonthsKeepDay(new Date(seg.from), m));
        if (d >= seg.to) break;
        boundaries.push(d);
      }
    }
    boundaries.push(seg.to);

    let prev = seg.from;
    for (const date of boundaries) {
      const exactGross = balance * rate * yearFraction(prev, date);
      const gross = round2(exactGross);
      const net = round2(gross * keep);
      const closing = capitalized ? round2(balance + net) : balance;
      if (!capitalized) paidExactGross += exactGross;
      entries.push({
        date,
        gross,
        tax: round2(gross - net),
        net,
        capitalized,
        openingBalance: balance,
        closingBalance: closing,
      });
      balance = closing;
      prev = date;
    }
  }

  // Paid-out entries sum exactly to the rounded total: the last one absorbs rounding.
  const last = entries.at(-1);
  if (last && !last.capitalized) {
    const paid = entries.filter(e => !e.capitalized);
    const totalGross = round2(paidExactGross);
    const totalNet = round2(totalGross * keep);
    const others = paid.slice(0, -1);
    last.gross = round2(totalGross - others.reduce((s, e) => s + e.gross, 0));
    last.net = round2(totalNet - others.reduce((s, e) => s + e.net, 0));
    last.tax = round2(last.gross - last.net);
  }
  return entries;
}

/**
 * Extra net interest the deposit would earn by capitalizing instead of paying interest out at the same
 * cadence, over the whole term and ignoring mid-term mode changes. Paid-out interest is optionally
 * reinvested at `reinvestRate` % until maturity (simple interest, taxed at the deposit's tax rate).
 */
function capitalizationDelta(details: DepositAccountDetails, reinvestRate: number): number {
  const clean = { ...details, modeHistory: undefined, modeEffectiveDate: undefined };
  const cadence =
    details.payout === DepositPayouts.Capitalized
      ? (details.capitalizationFrequency ?? DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY)
      : details.payout === DepositPayouts.Quarterly || details.payout === DepositPayouts.AtMaturity
        ? details.payout
        : DepositCapitalizationFrequencies.Monthly;
  const capitalized = buildDepositSchedule({
    ...clean,
    payout: DepositPayouts.Capitalized,
    capitalizationFrequency: cadence,
  });
  const paidOut = buildDepositSchedule({ ...clean, payout: cadence, capitalizationFrequency: undefined });
  const maturity = getDepositMaturityDate(details);
  const sumNet = (entries: DepositPayoutEntry[]) => entries.reduce((s, e) => s + e.net, 0);
  const reinvested = paidOut.reduce(
    (s, e) => s + e.net * (reinvestRate / 100) * yearFraction(e.date, maturity) * (1 - details.taxRate / 100),
    0,
  );
  return round2(sumNet(capitalized) - sumNet(paidOut) - reinvested);
}

/**
 * Computes the deposit summary as of a date. `interestReceived` is the net interest already
 * logged (from transactions); it is the only non-contractual input.
 */
export function calculateDepositSummary(
  details: DepositAccountDetails,
  opts: { asOfDate?: string; interestReceived?: number; reinvestRate?: number } = {},
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
  const projectedBalance = schedule.at(-1)?.closingBalance ?? details.principal;
  const limit = details.guaranteeLimit ?? null;
  const breachDate =
    limit == null
      ? null
      : details.principal > limit
        ? details.startDate
        : (schedule.find(e => e.closingBalance > limit)?.date ?? null);

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
    projectedMaturityBalance: projectedBalance,
    overGuarantee: limit != null && projectedBalance > limit,
    guaranteeBreachDate: breachDate,
    maxPrincipalWithinGuarantee:
      limit != null && projectedBalance > 0 ? round2((limit * details.principal) / projectedBalance) : null,
    capitalizationDelta: capitalizationDelta(details, opts.reinvestRate ?? details.reinvestRate ?? 0),
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
