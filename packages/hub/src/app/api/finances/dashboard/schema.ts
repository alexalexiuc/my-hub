import { z } from 'zod';
import { TransactionTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../shared.schema';

export const dashboardCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
});

export const dailySpendingPointSchema = z.object({
  day: z.number().int(),
  current: z.number().nullable(),
  prev: z.number(),
});

export const dashboardGoalSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  balance: z.number(),
  target: z.number(),
});

export const dashboardLoanCardSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: supportedCurrencySchema,
  balance: z.number(),
  monthsRemaining: z.number().int(),
  payoffDate: z.string(),
});

export const dashboardNeedsAttentionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
});

export const dashboardPortfolioSchema = z.object({
  currency: supportedCurrencySchema,
  value: z.number().nullable(),
  returnPct: z.number().nullable(),
});

export const dashboardTransactionSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.enum(TransactionTypes),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  accountName: z.string(),
  toAccountName: z.string().nullable(),
  addedByInitials: z.string().nullable(),
});

export const availableBudgetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  defaultCurrency: supportedCurrencySchema,
  isOwner: z.boolean(),
});

export const financeDashboardDataSchema = z.object({
  hasBudget: z.literal(true),
  budgetId: z.number().int(),
  budgetName: z.string(),
  currency: supportedCurrencySchema,
  amountsHidden: z.boolean(),
  availableBalance: z.number(),
  monthlyIncome: z.number(),
  monthlyExpense: z.number(),
  monthlyTransfers: z.number(),
  categories: z.array(dashboardCategorySchema),
  dailySpending: z.array(dailySpendingPointSchema),
  goals: z.array(dashboardGoalSchema),
  recentTransactions: z.array(dashboardTransactionSchema),
  budgetTotal: z.number(),
  budgetSpent: z.number(),
  excludedBudgetCategoriesCount: z.number().int(),
  portfolio: dashboardPortfolioSchema.nullable(),
  loans: z.array(dashboardLoanCardSchema),
  needsAttention: z.array(dashboardNeedsAttentionSchema),
});

export const noBudgetResponseSchema = z.object({
  hasBudget: z.literal(false),
  availableBudgets: z.array(availableBudgetSchema),
});

export const dashboardResponseSchema = z.union([financeDashboardDataSchema, noBudgetResponseSchema]);

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DailySpendingPoint = z.infer<typeof dailySpendingPointSchema>;
export type DashboardGoal = z.infer<typeof dashboardGoalSchema>;
export type DashboardLoanCard = z.infer<typeof dashboardLoanCardSchema>;
export type DashboardNeedsAttention = z.infer<typeof dashboardNeedsAttentionSchema>;
export type DashboardPortfolio = z.infer<typeof dashboardPortfolioSchema>;
export type DashboardTransaction = z.infer<typeof dashboardTransactionSchema>;
export type AvailableBudget = z.infer<typeof availableBudgetSchema>;
export type FinanceDashboardData = z.infer<typeof financeDashboardDataSchema>;
export type NoBudgetResponse = z.infer<typeof noBudgetResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
