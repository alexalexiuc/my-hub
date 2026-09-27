/**
 * Vacation planner domain constants.
 */

/** Unit a rule set's leave balance is counted in. */
export const LeaveUnits = {
  /** Every day of the span except art. 111 public holidays consumes balance (MD Labour Code today). */
  Calendar: 'calendar',
  /** Only scheduled working days consume balance (MD 2027 draft reform). */
  Working: 'working',
} as const;
export type LeaveUnit = (typeof LeaveUnits)[keyof typeof LeaveUnits];
export const LeaveUnitValues = Object.values(LeaveUnits) as [LeaveUnit, ...LeaveUnit[]];

/** Which average daily salary a leave day is paid at. */
export const RateBases = {
  /** HG 426: working-day average × working days / (calendar days − holidays) of the window. */
  CalendarDay: 'calendar_day',
  /** Earnings of the window / days actually worked in it. */
  WorkingDay: 'working_day',
} as const;
export type RateBasis = (typeof RateBases)[keyof typeof RateBases];
export const RateBasisValues = Object.values(RateBases) as [RateBasis, ...RateBasis[]];

export const RuleSetStatuses = {
  Active: 'active',
  /** Proposed law — ignored unless a query opts into draft rules. */
  Draft: 'draft',
} as const;
export type RuleSetStatus = (typeof RuleSetStatuses)[keyof typeof RuleSetStatuses];
export const RuleSetStatusValues = Object.values(RuleSetStatuses) as [RuleSetStatus, ...RuleSetStatus[]];

export const TaxRegimeKinds = {
  /** IT Park single tax is paid by the employer: no employee withholding. */
  ItPark: 'it_park',
  /** AOAM medical premium + income tax withheld from the employee. */
  Standard: 'standard',
} as const;
export type TaxRegimeKind = (typeof TaxRegimeKinds)[keyof typeof TaxRegimeKinds];
export const TaxRegimeKindValues = Object.values(TaxRegimeKinds) as [TaxRegimeKind, ...TaxRegimeKind[]];

/** Default employee withholding rates per regime (MD 2026). Stored on each regime row so they can change. */
export const DEFAULT_TAX_RATES: Record<TaxRegimeKind, { medicalRate: number; incomeTaxRate: number }> = {
  it_park: { medicalRate: 0, incomeTaxRate: 0 },
  standard: { medicalRate: 0.09, incomeTaxRate: 0.12 },
};

export const SalaryKinds = {
  Actual: 'actual',
  Projected: 'projected',
} as const;
export type SalaryKind = (typeof SalaryKinds)[keyof typeof SalaryKinds];
export const SalaryKindValues = Object.values(SalaryKinds) as [SalaryKind, ...SalaryKind[]];

export const LeaveStatuses = {
  Taken: 'taken',
  Planned: 'planned',
} as const;
export type LeaveStatus = (typeof LeaveStatuses)[keyof typeof LeaveStatuses];
export const LeaveStatusValues = Object.values(LeaveStatuses) as [LeaveStatus, ...LeaveStatus[]];

export const HolidayKinds = {
  /** Art. 111 non-working public holiday (incl. the local hram day): not a leave day, not paid as one. */
  Holiday: 'holiday',
  /** Weekday made a rest day by a Government transfer: an ordinary day off, so it consumes calendar leave. */
  TransferredOff: 'transferred_off',
  /** Weekend day made a working day by a Government transfer. */
  TransferredWorkday: 'transferred_workday',
} as const;
export type HolidayKind = (typeof HolidayKinds)[keyof typeof HolidayKinds];
export const HolidayKindValues = Object.values(HolidayKinds) as [HolidayKind, ...HolidayKind[]];

export const HolidaySources = {
  Manual: 'manual',
  Research: 'research',
} as const;
export type HolidaySource = (typeof HolidaySources)[keyof typeof HolidaySources];
export const HolidaySourceValues = Object.values(HolidaySources) as [HolidaySource, ...HolidaySource[]];

export const DayMarkers = {
  Weekend: 'weekend',
  Holiday: 'holiday',
  TransferredOff: 'transferred_off',
  TransferredWorkday: 'transferred_workday',
  LeaveTaken: 'leave_taken',
  LeavePlanned: 'leave_planned',
} as const;
export type DayMarker = (typeof DayMarkers)[keyof typeof DayMarkers];

export const WindowObjectives = {
  /** Highest net money for the span vs working it. */
  MaxMoney: 'max_money',
  /** Longest continuous time off, counting adjacent weekends and holidays. */
  MaxRest: 'max_rest',
  /** Fewest balance days for a wanted stretch of time off. */
  MinBalance: 'min_balance',
} as const;
export type WindowObjective = (typeof WindowObjectives)[keyof typeof WindowObjectives];
export const WindowObjectiveValues = Object.values(WindowObjectives) as [WindowObjective, ...WindowObjective[]];

/** Longest range a calendar query or best-window search may cover. */
export const VACATION_MAX_RANGE_DAYS = 366;
/** Longest leave span a window search considers. */
export const VACATION_MAX_SPAN_DAYS = 60;
/** How far past the opening balance date a query may look; bounds the day-by-day balance simulation. */
export const VACATION_MAX_HORIZON_YEARS = 20;
