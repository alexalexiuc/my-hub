/**
 * Vacation read queries. Each loads the user's data, builds one engine model and returns the
 * result together with the data-quality warnings the model raised.
 *
 * Exports:
 *   getVacationCalendar     — per-day rows (net delta, net amount, balance cost, markers) + month rates
 *   evaluateVacationSpan    — totals for one leave span
 *   getVacationBalance      — projected balance per rule-set bucket on a date
 *   findBestLeaveWindows    — ranked non-overlapping leave spans for an objective
 *   getVacationConfig       — profile, rule sets, tax regimes, leave periods, salary + holiday coverage
 *   getVacationLeaveEstimates — every recorded leave period with its span totals and rate
 *   listVacationSalaries    — every salary month, oldest first, with its month as YYYY-MM
 *   Types: VacationCalendarResult, VacationSpanResult, VacationBalanceResult, VacationWindowsResult,
 *          VacationConfig, VacationSalaryRow, BestWindowsQuery,
 *          VacationLeaveEstimate, VacationLeaveEstimatesResult
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  vacationHolidays,
  vacationLeavePeriods,
  vacationRuleSets,
  vacationSalaryMonths,
  vacationTaxRegimes,
} from '../../db/schema/vacation';
import type { VacationLeavePeriod, VacationProfile, VacationRuleSet, VacationTaxRegime } from '../../types';
import type { SalaryKind, WindowObjective } from '../../constants/vacation';
import { shiftMonthStr } from '../../utils/dates';
import {
  vacationHorizonError,
  vacationRangeError,
  type VacationBalance,
  type VacationCalendarRow,
  type VacationMonthRate,
  type VacationSpan,
} from '../../utils/vacation';
import { getVacationProfile, loadVacationModel, VacationValidationError, type VacationQueryOptions } from './data';

function assertRange(from: string, to: string) {
  const error = vacationRangeError(from, to);
  if (error) throw new VacationValidationError(error);
}

function assertWithinHorizon(profile: VacationProfile, date: string) {
  const error = vacationHorizonError(profile.openingBalanceDate, date);
  if (error) throw new VacationValidationError(error);
}

export interface VacationCalendarResult {
  /** True when answered from demo data (no profile yet). */
  demo: boolean;
  from: string;
  to: string;
  /** [date, net delta vs working, net amount, balance cost, markers] */
  rows: VacationCalendarRow[];
  rates: VacationMonthRate[];
  warnings: string[];
}

export interface VacationSpanResult {
  /** True when answered from demo data (no profile yet). */
  demo: boolean;
  span: VacationSpan;
  rate: VacationMonthRate | null;
  warnings: string[];
}

export interface VacationBalanceResult extends VacationBalance {
  /** True when answered from demo data (no profile yet). */
  demo: boolean;
  includePlanned: boolean;
  warnings: string[];
}

export interface BestWindowsQuery extends VacationQueryOptions {
  from: string;
  to: string;
  leaveDays?: number;
  restDays?: number;
  objective?: WindowObjective;
  top?: number;
}

export interface VacationWindowsResult {
  /** True when answered from demo data (no profile yet). */
  demo: boolean;
  objective: WindowObjective;
  windows: VacationSpan[];
  warnings: string[];
}

export interface VacationConfig {
  profile: VacationProfile | null;
  ruleSets: VacationRuleSet[];
  taxRegimes: VacationTaxRegime[];
  leavePeriods: VacationLeavePeriod[];
  salaryCoverage: {
    firstMonth: string | null;
    lastMonth: string | null;
    lastActualMonth: string | null;
    /** Months between the first and last row with no row (their base is carried forward). */
    missingMonths: string[];
  };
  holidayCoverage: { year: number; holidays: number; transfers: number }[];
  warnings: string[];
}

export async function getVacationCalendar(
  userId: string,
  q: VacationQueryOptions & { from: string; to: string },
): Promise<VacationCalendarResult> {
  assertRange(q.from, q.to);
  const { profile, model, demo } = await loadVacationModel(userId, q);
  assertWithinHorizon(profile, q.to);
  const { rows, rates } = model.calendar(q.from, q.to);
  return { from: q.from, to: q.to, rows, rates, warnings: model.warnings(), demo };
}

export async function evaluateVacationSpan(
  userId: string,
  q: VacationQueryOptions & { startDate: string; endDate: string },
): Promise<VacationSpanResult> {
  assertRange(q.startDate, q.endDate);
  const { profile, model, demo } = await loadVacationModel(userId, q);
  assertWithinHorizon(profile, q.endDate);
  const span = model.evaluateSpan(q.startDate, q.endDate);
  const warnings = model.warnings();
  if (span.overlapsExistingLeave) warnings.push('The span overlaps leave already recorded.');
  return { span, rate: model.rateFor(q.startDate), warnings, demo };
}

export async function getVacationBalance(
  userId: string,
  q: VacationQueryOptions & { date: string },
): Promise<VacationBalanceResult> {
  assertRange(q.date, q.date);
  const { profile, model, demo } = await loadVacationModel(userId, q);
  assertWithinHorizon(profile, q.date);
  const balance = model.balanceOn(q.date);
  return { ...balance, includePlanned: q.includePlanned ?? true, warnings: model.warnings(), demo };
}

/**
 * Ranks leave spans inside [from, to]. Pass `leaveDays` (balance days to spend; objective
 * max_money or max_rest) or `restDays` (continuous days off wanted; objective min_balance or max_money).
 */
export async function findBestLeaveWindows(userId: string, q: BestWindowsQuery): Promise<VacationWindowsResult> {
  assertRange(q.from, q.to);
  if ((q.leaveDays === undefined) === (q.restDays === undefined)) {
    throw new VacationValidationError(
      'Pass exactly one of leaveDays (balance days to spend) or restDays (continuous days off wanted).',
    );
  }
  const objective = q.objective ?? (q.leaveDays !== undefined ? 'max_money' : 'min_balance');
  if (q.leaveDays !== undefined && objective === 'min_balance') {
    throw new VacationValidationError('min_balance needs restDays: with leaveDays the balance spent is fixed.');
  }
  if (q.restDays !== undefined && objective === 'max_rest') {
    throw new VacationValidationError('max_rest needs leaveDays: with restDays the time off is fixed.');
  }
  const { profile, model, demo } = await loadVacationModel(userId, q);
  assertWithinHorizon(profile, q.to);
  const windows = model.findBestWindows({
    from: q.from,
    to: q.to,
    leaveDays: q.leaveDays,
    restDays: q.restDays,
    objective,
    top: q.top ?? 5,
  });
  const warnings = model.warnings();
  if (windows.length === 0)
    warnings.push('No span in the range fits: check the range, the day count and existing leave.');
  return { objective, windows, warnings, demo };
}

export interface VacationLeaveEstimate extends VacationLeavePeriod {
  /** The period priced as one leave (rate of its start month); null when no salary backs that rate. */
  estimate: VacationSpan | null;
  rate: VacationMonthRate | null;
}

export interface VacationLeaveEstimatesResult {
  /** True when answered from demo data (no profile yet). */
  demo: boolean;
  /** Oldest first. */
  leave: VacationLeaveEstimate[];
}

/**
 * Prices every recorded leave period as one leave: net pay, net delta vs working it, balance cost
 * and rest. Periods with no salary in their averaging window (e.g. before the first salary row)
 * get `estimate: null` rather than a misleading zero. Only the user's own rows are listed, so
 * demo mode (no profile) usually answers with an empty list.
 */
export async function getVacationLeaveEstimates(
  userId: string,
  q: VacationQueryOptions = {},
): Promise<VacationLeaveEstimatesResult> {
  const [{ profile, model, demo }, rows] = await Promise.all([
    loadVacationModel(userId, q),
    db
      .select()
      .from(vacationLeavePeriods)
      .where(eq(vacationLeavePeriods.userId, userId))
      .orderBy(asc(vacationLeavePeriods.startDate)),
  ]);
  const leave = rows
    .filter(l => vacationHorizonError(profile.openingBalanceDate, l.endDate) === null)
    .map(l => {
      const rate = model.rateFor(l.startDate);
      const priced = rate !== null && rate.windowMonths.length > 0;
      return { ...l, estimate: priced ? model.evaluateSpan(l.startDate, l.endDate) : null, rate: priced ? rate : null };
    });
  return { demo, leave };
}

export interface VacationSalaryRow {
  /** YYYY-MM the salary was earned in. */
  month: string;
  baseMdl: number;
  extraMdl: number;
  kind: SalaryKind;
  notes: string | null;
}

/**
 * Lists the user's salary months, oldest first. The DB stores each month as its first day;
 * this returns `YYYY-MM`, the same shape `applyVacationSetup` takes for upserts and removals.
 */
export async function listVacationSalaries(userId: string): Promise<VacationSalaryRow[]> {
  const rows = await db
    .select({
      month: vacationSalaryMonths.month,
      baseMdl: vacationSalaryMonths.baseMdl,
      extraMdl: vacationSalaryMonths.extraMdl,
      kind: vacationSalaryMonths.kind,
      notes: vacationSalaryMonths.notes,
    })
    .from(vacationSalaryMonths)
    .where(eq(vacationSalaryMonths.userId, userId))
    .orderBy(asc(vacationSalaryMonths.month));
  return rows.map(r => ({ ...r, month: r.month.slice(0, 7) }));
}

export async function getVacationConfig(userId: string, today: string): Promise<VacationConfig> {
  const [profile, ruleSets, taxRegimes, leavePeriods, salaries, holidays] = await Promise.all([
    getVacationProfile(userId),
    db
      .select()
      .from(vacationRuleSets)
      .where(eq(vacationRuleSets.userId, userId))
      .orderBy(asc(vacationRuleSets.validFrom)),
    db
      .select()
      .from(vacationTaxRegimes)
      .where(eq(vacationTaxRegimes.userId, userId))
      .orderBy(asc(vacationTaxRegimes.validFrom)),
    db
      .select()
      .from(vacationLeavePeriods)
      .where(eq(vacationLeavePeriods.userId, userId))
      .orderBy(asc(vacationLeavePeriods.startDate)),
    db
      .select({ month: vacationSalaryMonths.month, kind: vacationSalaryMonths.kind })
      .from(vacationSalaryMonths)
      .where(eq(vacationSalaryMonths.userId, userId))
      .orderBy(asc(vacationSalaryMonths.month)),
    db
      .select({ date: vacationHolidays.date, kind: vacationHolidays.kind })
      .from(vacationHolidays)
      .where(eq(vacationHolidays.userId, userId)),
  ]);

  const months = salaries.map(s => s.month.slice(0, 7));
  const missingMonths: string[] = [];
  if (months.length > 1) {
    const have = new Set(months);
    for (let m = months[0]!; m < months.at(-1)!; m = shiftMonthStr(m, 1)) if (!have.has(m)) missingMonths.push(m);
  }
  const actual = salaries.filter(s => s.kind === 'actual').map(s => s.month.slice(0, 7));

  const byYear = new Map<number, { year: number; holidays: number; transfers: number }>();
  for (const h of holidays) {
    const year = Number(h.date.slice(0, 4));
    const entry = byYear.get(year) ?? { year, holidays: 0, transfers: 0 };
    if (h.kind === 'holiday') entry.holidays++;
    else entry.transfers++;
    byYear.set(year, entry);
  }

  const warnings: string[] = [];
  const year = Number(today.slice(0, 4));
  if (!profile) warnings.push('No profile yet: set country, employer and opening balance with vacation_setup.');
  if (!ruleSets.some(r => r.status === 'active')) warnings.push('No active rule set: leave pay cannot be computed.');
  if (
    profile &&
    !taxRegimes.some(
      t =>
        t.employer.toLowerCase() === profile.employer.toLowerCase() &&
        t.validFrom <= today &&
        (t.validTo === null || today <= t.validTo),
    )
  ) {
    warnings.push(`No tax regime covers today for ${profile.employer}: amounts will be gross.`);
  }
  if (months.length === 0) warnings.push('No salaries recorded.');
  else if (months.at(-1)! < shiftMonthStr(today.slice(0, 7), -1)) {
    warnings.push(`Latest salary is ${months.at(-1)}; later months carry it forward.`);
  }
  if (!byYear.has(year)) warnings.push(`No holidays recorded for ${year}.`);
  if (today.slice(5, 7) >= '10' && !byYear.has(year + 1)) warnings.push(`No holidays recorded for ${year + 1} yet.`);

  return {
    profile: profile ?? null,
    ruleSets,
    taxRegimes,
    leavePeriods,
    salaryCoverage: {
      firstMonth: months[0] ?? null,
      lastMonth: months.at(-1) ?? null,
      lastActualMonth: actual.at(-1) ?? null,
      missingMonths,
    },
    holidayCoverage: [...byYear.values()].sort((a, b) => a.year - b.year),
    warnings,
  };
}
