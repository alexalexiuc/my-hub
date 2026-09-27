import { z } from 'zod';
import {
  applyLeaveChanges,
  applyVacationSetup,
  evaluateVacationSpan,
  findBestLeaveWindows,
  getVacationBalance,
  getVacationCalendar,
  getVacationConfig,
} from '@my-hub/shared/services';
import {
  HolidayKindValues,
  HolidaySourceValues,
  LeaveStatusValues,
  LeaveUnitValues,
  RateBasisValues,
  RuleSetStatusValues,
  SalaryKindValues,
  TaxRegimeKindValues,
  WindowObjectiveValues,
} from '@my-hub/shared/constants';
import { currentDateString, monthEndStr, shiftDateStr } from '@my-hub/shared/utils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { ToolHandler } from '../../shared/types';

const yyyyMmSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM');
const countrySchema = z.string().trim().length(2).describe('ISO 3166-1 alpha-2 country code, e.g. "MD".');
const regionSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .describe('Locality whose hram day applies, e.g. "Chisinau". Omit or null for national.');

const queryOptions = {
  includeDraftRules: z
    .boolean()
    .optional()
    .describe('Include draft rule sets (e.g. the 2027 working-day reform preview). Default false.'),
  includePlanned: z.boolean().optional().describe('Count planned leave in balances and in days worked. Default true.'),
};

// ---- vacation_setup ----------------------------------------------------------

const ruleSetSchema = z.object({
  id: z.number().int().optional().describe('Omit to create; pass an existing id to overwrite it.'),
  name: z.string().trim().min(1).describe('E.g. "MD Labour Code (calendar days)".'),
  country: countrySchema,
  region: regionSchema,
  validFrom: yyyyMmDdSchema,
  validTo: yyyyMmDdSchema.nullable().optional().describe('Inclusive end; omit/null for open-ended.'),
  leaveUnit: z
    .enum(LeaveUnitValues)
    .describe('calendar: every non-holiday day of a span consumes balance. working: only workdays do.'),
  annualEntitlementDays: z.number().positive().describe('Days per year in leaveUnit, e.g. 28 or 22.'),
  avgWindowMonths: z.number().int().min(1).max(12).optional().describe('Averaging window in months. Default 3.'),
  rateBasis: z
    .enum(RateBasisValues)
    .describe('calendar_day: HG 426 per-calendar-day average. working_day: earnings / days worked.'),
  raiseResetsWindow: z
    .boolean()
    .optional()
    .describe('A base-salary raise inside the window restarts the window at the raise month (HG 426). Default true.'),
  status: z.enum(RuleSetStatusValues).describe('draft = proposed law, used only when a query opts in.'),
  notes: z.string().nullable().optional(),
});

const taxRegimeSchema = z.object({
  id: z.number().int().optional(),
  employer: z.string().trim().min(1),
  regime: z.enum(TaxRegimeKindValues).describe('it_park: no employee withholding. standard: AOAM + income tax.'),
  medicalRate: z.number().min(0).max(1).optional().describe('AOAM share of gross. Defaults: standard 0.09, it_park 0.'),
  incomeTaxRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Income tax on gross − AOAM. Defaults: standard 0.12, it_park 0.'),
  validFrom: yyyyMmDdSchema,
  validTo: yyyyMmDdSchema.nullable().optional(),
});

const salarySchema = z.object({
  month: yyyyMmSchema.describe('Month the salary was EARNED in (not paid).'),
  baseMdl: z
    .number()
    .min(0)
    .describe(
      'Gross monthly base salary in MDL for a fully worked month. Carries forward to later months with no row.',
    ),
  extraMdl: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Other gross earnings for this month that count towards the average (bonuses, allowances). Not carried forward.',
    ),
  kind: z.enum(SalaryKindValues),
  notes: z.string().nullable().optional(),
});

const holidayKeySchema = z.object({ date: yyyyMmDdSchema, country: countrySchema, region: regionSchema });
const holidaySchema = holidayKeySchema.extend({
  kind: z
    .enum(HolidayKindValues)
    .describe(
      'holiday: art. 111 non-working day (incl. the local hram day). transferred_off: weekday made a rest day. ' +
        'transferred_workday: weekend day made a working day.',
    ),
  name: z.string().trim().min(1),
  source: z
    .enum(HolidaySourceValues)
    .optional()
    .describe('Default research. A manual row is never overwritten by research.'),
});

export const VacationSetupSchema = z.object({
  profile: z
    .object({
      country: countrySchema.optional(),
      region: regionSchema,
      employer: z.string().trim().min(1).optional(),
      openingBalanceDays: z
        .number()
        .optional()
        .describe('Leave balance on openingBalanceDate, in the unit of the rule set then in force.'),
      openingBalanceDate: yyyyMmDdSchema.optional(),
      accrualStart: yyyyMmDdSchema
        .nullable()
        .optional()
        .describe('Accrual starts after this date. Default: after openingBalanceDate.'),
    })
    .optional()
    .describe('Creating the profile needs country, employer, openingBalanceDays and openingBalanceDate.'),
  ruleSets: z
    .object({ upsert: z.array(ruleSetSchema).optional(), remove: z.array(z.number().int()).optional() })
    .optional(),
  taxRegimes: z
    .object({ upsert: z.array(taxRegimeSchema).optional(), remove: z.array(z.number().int()).optional() })
    .optional(),
  salaries: z.object({ upsert: z.array(salarySchema).optional(), remove: z.array(yyyyMmSchema).optional() }).optional(),
  holidays: z
    .object({ upsert: z.array(holidaySchema).optional(), remove: z.array(holidayKeySchema).optional() })
    .optional(),
});

export const vacationSetupTool: ToolHandler<typeof VacationSetupSchema.shape> = async (input, context) => {
  const summary = await applyVacationSetup(context.userId, input);
  const { warnings } = await getVacationConfig(context.userId, currentDateString(context.timezone));
  return toolResponse({ ...summary, warnings });
};

// ---- vacation_plan_leave -----------------------------------------------------

export const PlanLeaveSchema = z.object({
  upsert: z
    .array(
      z.object({
        id: z.number().int().optional().describe('Omit to add; pass an existing id to change it.'),
        startDate: yyyyMmDdSchema,
        endDate: yyyyMmDdSchema.describe('Inclusive.'),
        status: z.enum(LeaveStatusValues),
        payReceivedMdl: z
          .number()
          .min(0)
          .nullable()
          .optional()
          .describe('Leave pay actually received, for taken leave.'),
        notes: z.string().nullable().optional(),
      }),
    )
    .optional(),
  remove: z.array(z.number().int()).optional().describe('Leave period ids, from vacation_get_config.'),
});

export const planLeaveTool: ToolHandler<typeof PlanLeaveSchema.shape> = async (input, context) => {
  const today = currentDateString(context.timezone);
  const changes = await applyLeaveChanges(context.userId, input);
  const lastEnd = (input.upsert ?? [])
    .map(l => l.endDate)
    .sort()
    .at(-1);
  const [balanceToday, balanceAfter] = await Promise.all([
    getVacationBalance(context.userId, { date: today }),
    lastEnd && lastEnd > today ? getVacationBalance(context.userId, { date: lastEnd }) : null,
  ]);
  return toolResponse({ ...changes, balanceToday, balanceAfterLeave: balanceAfter });
};

// ---- vacation_get_calendar ---------------------------------------------------

export const GetCalendarSchema = z.object({
  from: yyyyMmDdSchema.optional().describe('Default: first day of the current month.'),
  to: yyyyMmDdSchema.optional().describe('Default: last day of the month of `from`. Max 366 days per call.'),
  ...queryOptions,
});

export const getCalendarTool: ToolHandler<typeof GetCalendarSchema.shape> = async (input, context) => {
  const from = input.from ?? `${currentDateString(context.timezone).slice(0, 7)}-01`;
  const to = input.to ?? monthEndStr(from.slice(0, 7));
  const result = await getVacationCalendar(context.userId, { ...input, from, to });
  return toolResponse({ columns: ['date', 'delta', 'amount', 'balanceCost', 'markers'], ...result });
};

// ---- vacation_estimate_leave_pay ---------------------------------------------

export const EstimateLeavePaySchema = z.object({
  startDate: yyyyMmDdSchema,
  endDate: yyyyMmDdSchema.describe('Inclusive.'),
  ...queryOptions,
});

export const estimateLeavePayTool: ToolHandler<typeof EstimateLeavePaySchema.shape> = async (input, context) => {
  return toolResponse(await evaluateVacationSpan(context.userId, input));
};

// ---- vacation_find_best_windows ----------------------------------------------

export const FindBestWindowsSchema = z.object({
  from: yyyyMmDdSchema.optional().describe('Earliest leave day. Default today.'),
  to: yyyyMmDdSchema.optional().describe('Latest leave day. Default 182 days after `from`. Max 366 days.'),
  leaveDays: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe('Balance days to spend ("take 7 days"). Pass this or restDays.'),
  restDays: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe('Continuous days off wanted, weekends and holidays included ("a 10-day break"). Pass this or leaveDays.'),
  objective: z
    .enum(WindowObjectiveValues)
    .optional()
    .describe('With leaveDays: max_money (default) or max_rest. With restDays: min_balance (default) or max_money.'),
  top: z.number().int().min(1).max(20).optional().describe('Default 5.'),
  ...queryOptions,
});

export const findBestWindowsTool: ToolHandler<typeof FindBestWindowsSchema.shape> = async (input, context) => {
  const from = input.from ?? currentDateString(context.timezone);
  const to = input.to ?? shiftDateStr(from, 182);
  return toolResponse(await findBestLeaveWindows(context.userId, { ...input, from, to }));
};

// ---- vacation_get_balance ----------------------------------------------------

export const GetBalanceSchema = z.object({
  date: yyyyMmDdSchema
    .optional()
    .describe('Balance at the end of this day. Default today; future dates are projections.'),
  ...queryOptions,
});

export const getBalanceTool: ToolHandler<typeof GetBalanceSchema.shape> = async (input, context) => {
  const date = input.date ?? currentDateString(context.timezone);
  return toolResponse(await getVacationBalance(context.userId, { ...input, date }));
};

// ---- vacation_get_config -----------------------------------------------------

export const GetConfigSchema = z.object({});

export const getConfigTool: ToolHandler<typeof GetConfigSchema.shape> = async (_input, context) => {
  return toolResponse(await getVacationConfig(context.userId, currentDateString(context.timezone)));
};
