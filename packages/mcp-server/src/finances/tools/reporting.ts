import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  getBudgetProgress,
  getCashflowSummary,
  getSpendingByPayee,
  getSpendingAggregates,
  getComparison,
  getNetWorthSummary,
} from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';

// ─── get_budget_progress ──────────────────────────────────────────────────────

export const GetBudgetProgressSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export const getBudgetProgressTool: ToolHandler<typeof GetBudgetProgressSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getBudgetProgress(userId, budget.id, input.month);
  return toolResponse(result);
};

// ─── get_cashflow_summary ─────────────────────────────────────────────────────

export const GetCashflowSummarySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getCashflowSummaryTool: ToolHandler<typeof GetCashflowSummarySchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getCashflowSummary(userId, budget.id, input.dateFrom, input.dateTo);
  return toolResponse(result);
};

// ─── get_spending_by_payee ────────────────────────────────────────────────────

export const GetSpendingByPayeeSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(100).optional(),
  categoryId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('When provided, only include transactions matching this category ID (top payees within a category).'),
});

export const getSpendingByPayeeTool: ToolHandler<typeof GetSpendingByPayeeSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getSpendingByPayee(
    userId,
    budget.id,
    input.dateFrom,
    input.dateTo,
    input.limit,
    input.categoryId,
  );
  return toolResponse(result);
};

// ─── get_spending_aggregates ──────────────────────────────────────────────────

export const GetSpendingAggregatesSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(['category', 'payee', 'account', 'month', 'type']),
  accountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  type: z.enum(TransactionTypes).optional(),
});

export const getSpendingAggregatesTool: ToolHandler<typeof GetSpendingAggregatesSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getSpendingAggregates(userId, budget.id, {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    groupBy: input.groupBy,
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
  });
  return toolResponse(result);
};

// ─── get_comparison ───────────────────────────────────────────────────────────

const PeriodSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const GetComparisonSchema = z.object({
  period1: PeriodSchema.describe('The baseline period (e.g. last year).'),
  period2: PeriodSchema.describe('The comparison period (e.g. this year).'),
  groupBy: z
    .enum(['category', 'payee', 'account'])
    .describe('Dimension to group spending by for the side-by-side comparison.'),
  accountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  type: z.enum(TransactionTypes).optional(),
});

export const getComparisonTool: ToolHandler<typeof GetComparisonSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getComparison(userId, budget.id, {
    period1: input.period1,
    period2: input.period2,
    groupBy: input.groupBy,
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
  });
  return toolResponse(result);
};

// ─── get_net_worth_summary ────────────────────────────────────────────────────

export const GetNetWorthSummarySchema = z.object({});

export const getNetWorthSummaryTool: ToolHandler<typeof GetNetWorthSummarySchema.shape> = async (_input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget.');

  const result = await getNetWorthSummary(userId, budget.id);
  return toolResponse(result);
};
