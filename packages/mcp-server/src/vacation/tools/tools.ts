import { McpServer } from '@modelcontextprotocol/server';
import { defineTool, registerTools } from '../../shared/toolsUtils';
import {
  EstimateLeavePaySchema,
  estimateLeavePayTool,
  FindBestWindowsSchema,
  findBestWindowsTool,
  GetBalanceSchema,
  getBalanceTool,
  GetCalendarSchema,
  getCalendarTool,
  GetConfigSchema,
  getConfigTool,
  PlanLeaveSchema,
  planLeaveTool,
  VacationSetupSchema,
  vacationSetupTool,
} from './vacation';

const MONEY_NOTE =
  'Amounts are MDL, net of employee withholding when a tax regime covers the day (gross otherwise, with a warning). ' +
  '`delta` is leave pay minus the salary forgone for that day: weekends inside a calendar-day leave are pure gain but ' +
  'consume balance; public holidays are neither paid nor charged. Always relay `warnings` to the user.';

const vacationTools = [
  defineTool({
    name: 'vacation_setup',
    description:
      'Set up or correct the vacation planner in one call: profile (country, locality, employer, opening leave ' +
      'balance), leave-law rule sets, tax regimes, monthly salaries and public holidays. Every section is optional ' +
      'and uses the same {upsert, remove} shape. Salaries are keyed by the month EARNED; a projected base ' +
      'carries forward, so a raise is one projected row ("from 2027-01, 45000"); months after the latest actual ' +
      'row use profile.baseSalaryMdl (gross) when set. Holidays: research the Labour Code art. 111 ' +
      'list, the local hram day and Government day transfers for the year, then write them here. The call is ' +
      'validated as a whole and applied in one transaction; it returns change counts plus coverage warnings.',
    inputSchema: VacationSetupSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: true },
    callback: vacationSetupTool,
  }),
  defineTool({
    name: 'vacation_plan_leave',
    description:
      'Record, change or remove leave periods (taken or planned). Periods may not overlap. Returns the balance ' +
      'today and after the latest added period. Use vacation_find_best_windows first when the user is still ' +
      'choosing dates, and vacation_get_config for ids to change or remove.',
    inputSchema: PlanLeaveSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: planLeaveTool,
  }),
  defineTool({
    name: 'vacation_find_best_windows',
    description:
      'Find the best dates to take leave in a range, e.g. "best time to take 7 days in May–July" (leaveDays: 7) or ' +
      '"cheapest way to get a 10-day break in autumn" (restDays: 10). Returns ranked, non-overlapping spans with ' +
      'balance cost, net money vs working and total rest days (adjacent weekends and holidays included). Spans ' +
      'overlapping recorded leave are skipped. ' +
      MONEY_NOTE,
    inputSchema: FindBestWindowsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: findBestWindowsTool,
  }),
  defineTool({
    name: 'vacation_estimate_leave_pay',
    description:
      'Estimate leave pay for specific dates ("what do I get for 14–25 July?"): balance cost, net amount, net ' +
      'delta vs working, rest days and the average daily rate used (fixed by the month the leave starts). ' +
      MONEY_NOTE,
    inputSchema: EstimateLeavePaySchema.shape,
    annotations: { readOnlyHint: true },
    callback: estimateLeavePayTool,
  }),
  defineTool({
    name: 'vacation_get_calendar',
    description:
      'Per-day view of what taking each day off is worth, as compact rows [date, delta, amount, balanceCost, ' +
      "markers], plus the rate per month. Each value assumes a leave starting in that day's month; use " +
      'vacation_estimate_leave_pay for a real span total rather than summing days. Max 366 days per call. ' +
      MONEY_NOTE,
    inputSchema: GetCalendarSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getCalendarTool,
  }),
  defineTool({
    name: 'vacation_get_balance',
    description:
      'Leave balance at the end of a date, split by rule-set bucket (e.g. pre-2027 calendar days vs 2027 working ' +
      'days), with accrual and planned leave applied. Future dates are projections.',
    inputSchema: GetBalanceSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getBalanceTool,
  }),
  defineTool({
    name: 'vacation_get_config',
    description:
      'Current vacation setup: profile, rule sets, tax regimes, leave periods (with ids), salary coverage (which ' +
      'months are missing) and holiday coverage per year, plus warnings about gaps. Call this before editing ' +
      'with vacation_setup or vacation_plan_leave.',
    inputSchema: GetConfigSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getConfigTool,
  }),
];

export function registerVacationTools(server: McpServer): void {
  registerTools(server, vacationTools);
}
