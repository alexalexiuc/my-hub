/**
 * Vacation pay engine (pure). Implements the Moldovan annual-leave pay method (HG 426/2004 as amended,
 * Labour Code art. 111–117) driven entirely by rule-set data, so a new regime is a new row, not code.
 *
 * Exports:
 *   createVacationModel(input)  — builds a model over one user's data; every query below runs on it:
 *     .rateFor(date)            — the average daily rate a leave starting in that date's month is paid at
 *     .calendar(from, to)       — per-day rows: net delta vs working, net amount, balance cost, markers
 *     .evaluateSpan(start, end) — totals for one leave span (rate fixed by the start month)
 *     .balanceOn(date)          — projected balance per rule-set bucket at the end of a date
 *     .findBestWindows(opts)    — ranked, non-overlapping leave spans for an objective
 *     .warnings()               — de-duplicated data-quality warnings raised by the queries run so far
 *   classifyVacationDay(date, holidays) — workday | rest | holiday, plus its markers
 *   vacationRangeError(from, to)        — why a query range is unusable (invalid date, inverted, too long), or null
 *   vacationHorizonError(opening, date) — why a date is too far past the opening balance date, or null
 *   Types: VacationModelInput (+ rule/tax/salary/holiday/leave inputs), VacationMonthRate,
 *          VacationCalendarRow, VacationSpan, VacationBalance, VacationWindowSearch
 *
 * Money is MDL. `amount` and `delta` are net of employee withholding when a tax regime covers the day,
 * gross otherwise (with a warning). All dates are YYYY-MM-DD strings, handled in UTC.
 */
import { calendarDays, isIsoDateStr, monthEndStr, shiftDateStr, shiftMonthStr } from './dates';
import type {
  DayMarker,
  HolidayKind,
  LeaveStatus,
  LeaveUnit,
  RateBasis,
  RuleSetStatus,
  SalaryKind,
  WindowObjective,
} from '../constants/vacation';
import { VACATION_MAX_HORIZON_YEARS, VACATION_MAX_RANGE_DAYS, VACATION_MAX_SPAN_DAYS } from '../constants/vacation';

export interface VacationRuleInput {
  id: number;
  name: string;
  region: string | null;
  validFrom: string;
  validTo: string | null;
  leaveUnit: LeaveUnit;
  annualEntitlementDays: number;
  avgWindowMonths: number;
  rateBasis: RateBasis;
  raiseResetsWindow: boolean;
  status: RuleSetStatus;
}

export interface VacationTaxInput {
  validFrom: string;
  validTo: string | null;
  medicalRate: number;
  incomeTaxRate: number;
}

export interface VacationSalaryInput {
  /** YYYY-MM or YYYY-MM-DD (the day is ignored). */
  month: string;
  baseMdl: number;
  extraMdl: number;
  kind: SalaryKind;
}

export interface VacationHolidayInput {
  date: string;
  kind: HolidayKind;
  name: string;
}

export interface VacationLeaveInput {
  id: number;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
}

export interface VacationModelInput {
  openingBalanceDays: number;
  openingBalanceDate: string;
  accrualStart: string | null;
  /** Rule sets already narrowed to the profile's country and region. */
  ruleSets: VacationRuleInput[];
  /** Tax regimes already narrowed to the profile's employer. */
  taxRegimes: VacationTaxInput[];
  salaries: VacationSalaryInput[];
  /** One entry per date, already resolved (a regional entry beats a national one). */
  holidays: VacationHolidayInput[];
  leavePeriods: VacationLeaveInput[];
  includeDraftRules: boolean;
  includePlanned: boolean;
}

export interface VacationMonthRate {
  /** YYYY-MM the leave starts in. */
  month: string;
  ruleSetId: number;
  ruleSetName: string;
  rateBasis: RateBasis;
  /** Gross MDL per paid leave day under the rule set's basis. */
  rateGross: number;
  workingDayRate: number;
  calendarDayRate: number;
  /** YYYY-MM months the average was actually taken over. */
  windowMonths: string[];
}

/** [date, net delta vs working, net amount, balance cost, markers]. */
export type VacationCalendarRow = [string, number, number, number, DayMarker[]];

export interface VacationSpan {
  startDate: string;
  endDate: string;
  calendarDays: number;
  workdays: number;
  balanceCost: number;
  amountNet: number;
  deltaNet: number;
  /** Continuous days off including adjacent weekends, holidays and existing leave. */
  restDays: number;
  restFrom: string;
  restTo: string;
  /** Balance left across all buckets at the end of the span. */
  balanceAfter: number;
  overlapsExistingLeave: boolean;
}

export interface VacationBalance {
  date: string;
  totalDays: number;
  buckets: { ruleSetId: number; ruleSetName: string; leaveUnit: LeaveUnit; days: number }[];
}

export interface VacationWindowSearch {
  from: string;
  to: string;
  /** Balance days to spend. Mutually exclusive with `restDays`. */
  leaveDays?: number;
  /** Continuous days off wanted. Mutually exclusive with `leaveDays`. */
  restDays?: number;
  objective: WindowObjective;
  top: number;
}

type DayKind = 'workday' | 'rest' | 'holiday';
type Balances = Map<number, number>;

const EPS = 1e-9;
const round2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (date: string) => date.slice(0, 7);
const utcDay = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const daysInYear = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365);

/** Inclusive list of YYYY-MM-DD dates from `from` to `to`. */
const datesBetween = (from: string, to: string) =>
  calendarDays(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));

const daysInMonth = (month: string) => datesBetween(`${month}-01`, monthEndStr(month));

/**
 * Classifies one date. Art. 111 holidays stay holidays even on a weekend (they never count towards
 * calendar-day leave); a Government-transferred rest day is an ordinary day off; a transferred
 * working Saturday is a workday.
 */
export function classifyVacationDay(
  date: string,
  holidays: ReadonlyMap<string, VacationHolidayInput>,
): { kind: DayKind; markers: DayMarker[] } {
  const markers: DayMarker[] = [];
  const weekday = utcDay(date);
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) markers.push('weekend');
  const holiday = holidays.get(date);
  if (holiday) markers.push(holiday.kind);
  if (holiday?.kind === 'holiday') return { kind: 'holiday', markers };
  if (holiday?.kind === 'transferred_off') return { kind: 'rest', markers };
  if (holiday?.kind === 'transferred_workday') return { kind: 'workday', markers };
  return { kind: weekend ? 'rest' : 'workday', markers };
}

/** Balance days one leave day costs under a unit. */
function leaveCost(unit: LeaveUnit, kind: DayKind): number {
  if (unit === 'calendar') return kind === 'holiday' ? 0 : 1;
  return kind === 'workday' ? 1 : 0;
}

/**
 * Builds a vacation model over one user's data. Queries are memoised per model, so build one per
 * request and run every query for it on the same instance.
 */
export function createVacationModel(input: VacationModelInput) {
  const warnings = new Set<string>();
  const holidays = new Map(input.holidays.map(h => [h.date, h]));
  const salaries = input.salaries
    .map(s => ({ ...s, month: s.month.slice(0, 7) }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const rules = input.ruleSets
    .filter(r => r.status === 'active' || input.includeDraftRules)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const ruleById = new Map(rules.map(r => [r.id, r]));

  const leaveByDate = new Map<string, LeaveStatus>();
  for (const period of input.leavePeriods) {
    for (const d of datesBetween(period.startDate, period.endDate)) leaveByDate.set(d, period.status);
  }
  const countsAsLeave = (date: string) => {
    const status = leaveByDate.get(date);
    return status === 'taken' || (status === 'planned' && input.includePlanned);
  };

  const dayCache = new Map<string, ReturnType<typeof classifyVacationDay>>();
  const day = (date: string) => {
    let hit = dayCache.get(date);
    if (!hit) {
      hit = classifyVacationDay(date, holidays);
      dayCache.set(date, hit);
    }
    return hit;
  };

  // ---- Rule sets ----------------------------------------------------------

  const ruleCache = new Map<string, VacationRuleInput | null>();
  /**
   * The rule set in force on a date. Among rule sets covering it, a draft wins (it only takes part
   * when drafts are requested, and then it is the law being previewed), then a regional one, then
   * the latest start. With none covering the date, the latest rule set already started is extended:
   * a law stays in force until something replaces it.
   */
  function ruleOn(date: string): VacationRuleInput | null {
    if (ruleCache.has(date)) return ruleCache.get(date)!;
    const rank = (r: VacationRuleInput) => (r.status === 'draft' ? 2 : 0) + (r.region ? 1 : 0);
    const covering = rules
      .filter(r => r.validFrom <= date && (r.validTo === null || date <= r.validTo))
      .sort((a, b) => rank(b) - rank(a) || b.validFrom.localeCompare(a.validFrom));
    let rule = covering[0] ?? null;
    if (!rule) {
      rule = [...rules].reverse().find(r => r.validFrom <= date) ?? null;
      if (rule)
        warnings.add(`Rule set "${rule.name}" ended ${rule.validTo}; no later rule set applies, so it is extended.`);
      else warnings.add(`No rule set is in force on ${date}.`);
    }
    ruleCache.set(date, rule);
    return rule;
  }

  // ---- Salaries -----------------------------------------------------------

  const salaryByMonth = new Map(salaries.map(s => [s.month, s]));
  const baseCache = new Map<string, number | null>();
  /** Months that borrowed a carried-forward base, keyed by the source, reported as one warning each. */
  const carried = new Map<string, string[]>();

  /** Base salary for a month: its own row, else the latest earlier row carried forward. */
  function baseFor(month: string): number | null {
    if (baseCache.has(month)) return baseCache.get(month)!;
    let found: (typeof salaries)[number] | undefined;
    for (const s of salaries) {
      if (s.month > month) break;
      found = s;
    }
    if (found && found.month !== month) {
      const key = `${found.kind} base from ${found.month}`;
      carried.set(key, [...(carried.get(key) ?? []), month]);
    }
    const base = found?.baseMdl ?? null;
    baseCache.set(month, base);
    return base;
  }

  const extraFor = (month: string) => salaryByMonth.get(month)?.extraMdl ?? 0;

  const monthCache = new Map<
    string,
    { calendarDays: number; holidays: number; workingDays: number; workedDays: number }
  >();
  function monthStats(month: string) {
    let hit = monthCache.get(month);
    if (!hit) {
      hit = { calendarDays: 0, holidays: 0, workingDays: 0, workedDays: 0 };
      for (const d of daysInMonth(month)) {
        const { kind } = day(d);
        hit.calendarDays++;
        if (kind === 'holiday') hit.holidays++;
        if (kind === 'workday') {
          hit.workingDays++;
          if (!countsAsLeave(d)) hit.workedDays++;
        }
      }
      monthCache.set(month, hit);
    }
    return hit;
  }

  /** Gross pay for a scheduled working day: the monthly base spread over that month's working days. */
  function workdayPay(date: string): number {
    const month = monthOf(date);
    const base = baseFor(month);
    const { workingDays } = monthStats(month);
    return base === null || workingDays === 0 ? 0 : base / workingDays;
  }

  // ---- Average daily rate (HG 426) -------------------------------------------

  /**
   * Picks the months the average is taken over for a leave starting in `startMonth`.
   * - The window is the `avgWindowMonths` full months before the start month.
   * - Months before the first salary row are left out (employment shorter than the window).
   * - A base raise inside the window restarts it at the raise month, when the rule set says so.
   * - With no day worked in the window, the latest months with work within the prior 12 are used.
   */
  function averagingWindow(rule: VacationRuleInput, startMonth: string): string[] {
    const n = rule.avgWindowMonths;
    let window: string[] = [];
    for (let i = n; i >= 1; i--) {
      const m = shiftMonthStr(startMonth, -i);
      if (baseFor(m) !== null) window.push(m);
      else warnings.add(`No salary data for ${m}; it is left out of the averaging window.`);
    }

    if (rule.raiseResetsWindow && window.length > 1) {
      let startIdx = 0;
      for (let i = 1; i < window.length; i++) {
        const prev = baseFor(shiftMonthStr(window[i]!, -1));
        const cur = baseFor(window[i]!);
        if (prev !== null && cur !== null && cur > prev + EPS) startIdx = i;
      }
      if (startIdx > 0) {
        warnings.add(
          `Base salary rose in ${window[startIdx]}; the average for leave starting ${startMonth} uses ${window[startIdx]} onwards.`,
        );
        window = window.slice(startIdx);
      }
    }

    const last = window.at(-1);
    const baseAtStart = baseFor(startMonth);
    const baseAtLast = last ? baseFor(last) : null;
    if (last && baseAtStart !== null && baseAtLast !== null && baseAtStart > baseAtLast + EPS) {
      warnings.add(
        `Base salary rises in ${startMonth}, after the averaging window; confirm with payroll whether the average is adjusted.`,
      );
    }

    if (window.length > 0 && window.every(m => monthStats(m).workedDays === 0)) {
      const fallback: string[] = [];
      for (let i = 1; i <= 12 && fallback.length < n; i++) {
        const m = shiftMonthStr(startMonth, -i);
        if (baseFor(m) !== null && monthStats(m).workedDays > 0) fallback.unshift(m);
      }
      warnings.add(
        `No days worked in the window before ${startMonth}; using the latest months with work: ${fallback.join(', ') || 'none'}.`,
      );
      window = fallback;
    }
    return window;
  }

  const rateCache = new Map<string, VacationMonthRate | null>();
  /**
   * Average daily rate for leave starting in `startMonth` under `rule`:
   *   earnings(m)       = base(m) × workedDays(m) / workingDays(m) + extra(m)   (leave pay excluded)
   *   workingDayRate    = Σ earnings / Σ workedDays
   *   calendarDayRate   = workingDayRate × Σ workingDays / Σ (calendarDays − holidays)
   */
  function rateForRule(rule: VacationRuleInput, startMonth: string): VacationMonthRate | null {
    const key = `${rule.id}|${startMonth}`;
    if (rateCache.has(key)) return rateCache.get(key)!;

    const window = averagingWindow(rule, startMonth);
    let earnings = 0;
    let worked = 0;
    let working = 0;
    let calendarExclHolidays = 0;
    for (const m of window) {
      const stats = monthStats(m);
      const base = baseFor(m) ?? 0;
      earnings += (stats.workingDays > 0 ? (base * stats.workedDays) / stats.workingDays : 0) + extraFor(m);
      worked += stats.workedDays;
      working += stats.workingDays;
      calendarExclHolidays += stats.calendarDays - stats.holidays;
    }

    let result: VacationMonthRate | null = null;
    if (worked > 0 && calendarExclHolidays > 0) {
      const workingDayRate = earnings / worked;
      const calendarDayRate = (workingDayRate * working) / calendarExclHolidays;
      result = {
        month: startMonth,
        ruleSetId: rule.id,
        ruleSetName: rule.name,
        rateBasis: rule.rateBasis,
        rateGross: rule.rateBasis === 'calendar_day' ? calendarDayRate : workingDayRate,
        workingDayRate,
        calendarDayRate,
        windowMonths: window,
      };
    } else {
      warnings.add(`Cannot compute a rate for leave starting ${startMonth}: no salary with worked days in the window.`);
    }
    rateCache.set(key, result);
    return result;
  }

  // ---- Tax --------------------------------------------------------------

  /** Share of a gross amount the employee keeps on a date: (1 − AOAM) × (1 − income tax). */
  function netFactor(date: string): number {
    const regime = input.taxRegimes.find(t => t.validFrom <= date && (t.validTo === null || date <= t.validTo));
    if (!regime) {
      warnings.add(`No tax regime covers ${date}; amounts are gross.`);
      return 1;
    }
    return (1 - regime.medicalRate) * (1 - regime.incomeTaxRate);
  }

  // ---- Balance simulation ---------------------------------------------------

  const snapshots = new Map<string, Balances>();
  let simulatedTo = input.openingBalanceDate;
  {
    const openingRule = ruleOn(input.openingBalanceDate);
    const opening: Balances = new Map();
    if (openingRule) opening.set(openingRule.id, input.openingBalanceDays);
    snapshots.set(input.openingBalanceDate, opening);
  }

  const accrualFrom = input.accrualStart && input.accrualStart > input.openingBalanceDate ? input.accrualStart : null;
  function accrue(date: string, balances: Balances) {
    if (date <= input.openingBalanceDate || (accrualFrom && date < accrualFrom)) return;
    const rule = ruleOn(date);
    if (!rule) return;
    const year = Number(date.slice(0, 4));
    balances.set(rule.id, (balances.get(rule.id) ?? 0) + rule.annualEntitlementDays / daysInYear(year));
  }

  /** Oldest bucket with balance left; else the rule set in force (which then goes negative). */
  function pickBucket(date: string, balances: Balances): VacationRuleInput | null {
    for (const rule of rules) {
      if ((balances.get(rule.id) ?? 0) > EPS) return rule;
    }
    return ruleOn(date);
  }

  /** Consumes one leave day; returns the rule set it was charged to and its cost. */
  function consume(date: string, balances: Balances): { rule: VacationRuleInput | null; cost: number } {
    const rule = pickBucket(date, balances);
    if (!rule) return { rule: null, cost: 0 };
    const cost = leaveCost(rule.leaveUnit, day(date).kind);
    balances.set(rule.id, (balances.get(rule.id) ?? 0) - cost);
    // An older bucket running below zero hands its deficit to the bucket in force.
    const current = ruleOn(date);
    const left = balances.get(rule.id)!;
    if (left < -EPS && current && current.id !== rule.id) {
      balances.set(current.id, (balances.get(current.id) ?? 0) + left);
      balances.set(rule.id, 0);
    }
    return { rule, cost };
  }

  /** Balances at the end of `date` with existing leave applied. Dates before the opening date return the opening snapshot. */
  function balancesAt(date: string): Balances {
    if (date <= input.openingBalanceDate) {
      if (date < input.openingBalanceDate) {
        warnings.add(
          `Balance before the opening date ${input.openingBalanceDate} is not tracked; using the opening balance.`,
        );
      }
      return snapshots.get(input.openingBalanceDate)!;
    }
    while (simulatedTo < date) {
      const next = shiftDateStr(simulatedTo, 1);
      const balances = new Map(snapshots.get(simulatedTo)!);
      accrue(next, balances);
      if (countsAsLeave(next)) consume(next, balances);
      snapshots.set(next, balances);
      simulatedTo = next;
    }
    return snapshots.get(date)!;
  }

  const sumBalances = (b: Balances) => [...b.values()].reduce((a, v) => a + v, 0);

  // ---- Public queries -------------------------------------------------------

  /** The bucket a leave day on `date` would be charged to, with that day's accrual applied. */
  function bucketOn(date: string): VacationRuleInput | null {
    const balances = new Map(balancesAt(shiftDateStr(date, -1)));
    accrue(date, balances);
    return pickBucket(date, balances);
  }

  /**
   * Net value of one leave day charged to `rule` at `cost` balance days, paid at the rate of a
   * leave starting in `rateMonth`, against the pay forgone in the day's own month.
   */
  function priceDay(date: string, rule: VacationRuleInput | null, cost: number, rateMonth: string) {
    const rate = rule ? rateForRule(rule, rateMonth) : null;
    const amount = cost * (rate?.rateGross ?? 0);
    const baseline = day(date).kind === 'workday' ? workdayPay(date) : 0;
    const factor = netFactor(date);
    return { rate, amountNet: amount * factor, deltaNet: (amount - baseline) * factor };
  }

  function rateFor(date: string): VacationMonthRate | null {
    const rule = bucketOn(date);
    return rule ? rateForRule(rule, monthOf(date)) : null;
  }

  function calendar(from: string, to: string): { rows: VacationCalendarRow[]; rates: VacationMonthRate[] } {
    const rows: VacationCalendarRow[] = [];
    const rates = new Map<string, VacationMonthRate>();
    for (const date of datesBetween(from, to)) {
      const { kind, markers } = day(date);
      const status = leaveByDate.get(date);
      const allMarkers: DayMarker[] = status
        ? [...markers, status === 'taken' ? 'leave_taken' : 'leave_planned']
        : markers;
      const rule = bucketOn(date);
      const cost = rule ? leaveCost(rule.leaveUnit, kind) : 0;
      const { rate, amountNet, deltaNet } = priceDay(date, rule, cost, monthOf(date));
      if (rate) rates.set(`${rate.ruleSetId}|${rate.month}`, rate);
      rows.push([date, round2(deltaNet), round2(amountNet), cost, allMarkers]);
    }
    return { rows, rates: [...rates.values()] };
  }

  /** Continuous time off around a span: extends over non-workdays and existing leave on both sides. */
  function restAround(start: string, end: string): { restFrom: string; restTo: string; restDays: number } {
    const off = (d: string) => day(d).kind !== 'workday' || leaveByDate.has(d);
    let restFrom = start;
    for (let i = 0; i < VACATION_MAX_SPAN_DAYS && off(shiftDateStr(restFrom, -1)); i++)
      restFrom = shiftDateStr(restFrom, -1);
    let restTo = end;
    for (let i = 0; i < VACATION_MAX_SPAN_DAYS && off(shiftDateStr(restTo, 1)); i++) restTo = shiftDateStr(restTo, 1);
    return { restFrom, restTo, restDays: datesBetween(restFrom, restTo).length };
  }

  /**
   * Totals for taking leave from `start` to `end`. The rate is fixed by the start month (for the
   * bucket each day is charged to); the pay forgone uses each day's own month.
   */
  function evaluateSpan(start: string, end: string): VacationSpan {
    const balances = new Map(balancesAt(shiftDateStr(start, -1)));
    const startMonth = monthOf(start);
    let cost = 0;
    let amountNet = 0;
    let deltaNet = 0;
    let workdays = 0;
    let overlaps = false;
    let minBalance = Infinity;
    const dates = datesBetween(start, end);
    for (const date of dates) {
      if (leaveByDate.has(date)) overlaps = true;
      accrue(date, balances);
      const { rule, cost: dayCost } = consume(date, balances);
      const priced = priceDay(date, rule, dayCost, startMonth);
      if (day(date).kind === 'workday') workdays++;
      cost += dayCost;
      amountNet += priced.amountNet;
      deltaNet += priced.deltaNet;
      minBalance = Math.min(minBalance, sumBalances(balances));
    }
    if (minBalance < -EPS) warnings.add(`Leave ${start}–${end} takes the balance to ${round2(minBalance)} days.`);
    return {
      startDate: start,
      endDate: end,
      calendarDays: dates.length,
      workdays,
      balanceCost: round2(cost),
      amountNet: round2(amountNet),
      deltaNet: round2(deltaNet),
      ...restAround(start, end),
      balanceAfter: round2(sumBalances(balances)),
      overlapsExistingLeave: overlaps,
    };
  }

  function balanceOn(date: string): VacationBalance {
    const balances = balancesAt(date);
    return {
      date,
      totalDays: round2(sumBalances(balances)),
      buckets: [...balances.entries()].map(([id, days]) => {
        const rule = ruleById.get(id)!;
        return { ruleSetId: id, ruleSetName: rule.name, leaveUnit: rule.leaveUnit, days: round2(days) };
      }),
    };
  }

  /** Leave spans that spend exactly `leaveDays` balance days, starting and ending on a charged day. */
  function spansForLeaveDays(from: string, to: string, leaveDays: number): [string, string][] {
    const spans: [string, string][] = [];
    for (let start = from; start <= to; start = shiftDateStr(start, 1)) {
      const balances = new Map(balancesAt(shiftDateStr(start, -1)));
      let spent = 0;
      let date = start;
      for (let i = 0; i < VACATION_MAX_SPAN_DAYS && date <= to; i++, date = shiftDateStr(date, 1)) {
        accrue(date, balances);
        const { cost } = consume(date, balances);
        if (i === 0 && cost === 0) break;
        spent += cost;
        if (spent >= leaveDays - EPS && cost > 0) {
          spans.push([start, date]);
          break;
        }
      }
    }
    return spans;
  }

  /** Leave spans that give `restDays` continuous days off: the stretch trimmed of off days at both ends. */
  function spansForRestDays(from: string, to: string, restDays: number): [string, string][] {
    const seen = new Set<string>();
    const spans: [string, string][] = [];
    for (let s = from; shiftDateStr(s, restDays - 1) <= to; s = shiftDateStr(s, 1)) {
      let a = s;
      let b = shiftDateStr(s, restDays - 1);
      while (a <= b && day(a).kind !== 'workday') a = shiftDateStr(a, 1);
      while (b >= a && day(b).kind !== 'workday') b = shiftDateStr(b, -1);
      if (a > b) continue;
      const key = `${a}|${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        spans.push([a, b]);
      }
    }
    return spans;
  }

  function findBestWindows(search: VacationWindowSearch): VacationSpan[] {
    const { from, to, leaveDays, restDays, objective, top } = search;
    const candidates = (
      leaveDays !== undefined ? spansForLeaveDays(from, to, leaveDays) : spansForRestDays(from, to, restDays!)
    )
      .map(([a, b]) => evaluateSpan(a, b))
      .filter(span => !span.overlapsExistingLeave);

    const byMoney = (x: VacationSpan, y: VacationSpan) => y.deltaNet - x.deltaNet || y.restDays - x.restDays;
    const compare: Record<WindowObjective, (x: VacationSpan, y: VacationSpan) => number> = {
      max_money: byMoney,
      max_rest: (x, y) => y.restDays - x.restDays || byMoney(x, y),
      min_balance: (x, y) => x.balanceCost - y.balanceCost || byMoney(x, y),
    };
    candidates.sort(compare[objective]);

    const picked: VacationSpan[] = [];
    for (const span of candidates) {
      if (picked.length >= top) break;
      if (picked.some(p => span.startDate <= p.endDate && p.startDate <= span.endDate)) continue;
      picked.push(span);
    }
    return picked;
  }

  return {
    rateFor,
    calendar,
    evaluateSpan,
    balanceOn,
    findBestWindows,
    warnings: () => [
      ...[...carried].map(([source, months]) => {
        const sorted = [...months].sort();
        const span = sorted.length === 1 ? sorted[0] : `${sorted[0]} to ${sorted.at(-1)}`;
        return `No salary for ${span}; carrying forward ${source}.`;
      }),
      ...warnings,
    ],
  };
}

export type VacationModel = ReturnType<typeof createVacationModel>;

/** Why a query range is unusable (inverted or longer than the cap), or null when it is fine. */
export function vacationRangeError(from: string, to: string): string | null {
  for (const date of [from, to]) if (!isIsoDateStr(date)) return `${date} is not a valid YYYY-MM-DD date.`;
  if (to < from) return `Range end ${to} is before its start ${from}.`;
  if (datesBetween(from, to).length > VACATION_MAX_RANGE_DAYS) {
    return `Range ${from}–${to} is longer than ${VACATION_MAX_RANGE_DAYS} days.`;
  }
  return null;
}

/**
 * Why `date` is too far past the opening balance date to simulate, or null when it is fine. The
 * balance is walked day by day from the opening date, so an unbounded date is an unbounded loop.
 */
export function vacationHorizonError(openingBalanceDate: string, date: string): string | null {
  const limit = `${Number(openingBalanceDate.slice(0, 4)) + VACATION_MAX_HORIZON_YEARS}${openingBalanceDate.slice(4)}`;
  if (date <= limit) return null;
  return `${date} is more than ${VACATION_MAX_HORIZON_YEARS} years after the opening balance date ${openingBalanceDate}.`;
}
