import { z } from 'zod';
import { route } from '@/lib/api/route';
import {
  getAccounts,
  getCategories,
  getTransactions,
  getTransactionListItems,
  getAvailableBalance,
  getUserActiveBudget,
  getUserBudgets,
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes } from '@my-hub/shared/constants';
import type { GoalAccountDetails } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';
import { categoryIconSchema, categoryColorSchema } from '../shared.schema';

export const dashboardCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
  target: z.number(),
});

export const dashboardGoalSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  balance: z.number(),
  target: z.number(),
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
  availableBalance: z.number(),
  monthlyIncome: z.number(),
  monthlyExpense: z.number(),
  categories: z.array(dashboardCategorySchema),
  goals: z.array(dashboardGoalSchema),
  recentTransactions: z.array(dashboardTransactionSchema),
});

export const noBudgetResponseSchema = z.object({
  hasBudget: z.literal(false),
  availableBudgets: z.array(availableBudgetSchema),
});

export const dashboardResponseSchema = z.union([financeDashboardDataSchema, noBudgetResponseSchema]);

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DashboardGoal = z.infer<typeof dashboardGoalSchema>;
export type DashboardTransaction = z.infer<typeof dashboardTransactionSchema>;
export type AvailableBudget = z.infer<typeof availableBudgetSchema>;
export type FinanceDashboardData = z.infer<typeof financeDashboardDataSchema>;
export type NoBudgetResponse = z.infer<typeof noBudgetResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const GET = route({ response: dashboardResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) {
    const allBudgets = await getUserBudgets(user.id);
    return {
      hasBudget: false,
      availableBudgets: allBudgets.map(b => ({
        id: b.id,
        name: b.name,
        defaultCurrency: b.defaultCurrency,
        isOwner: b.createdByUserId === user.id,
      })),
    };
  }

  const budgetId = budget.id;
  const currency = budget.defaultCurrency;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const [accounts, categories, expenseTxns, incomeTxns, recentTxns, availableBalance] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Expense,
      fromDate: monthStart,
      toDate: today,
      limit: 2000,
    }),
    getTransactions(user.id, budgetId, {
      type: TransactionTypes.Income,
      fromDate: monthStart,
      toDate: today,
      limit: 2000,
    }),
    getTransactionListItems(user.id, budgetId, { limit: 5 }),
    getAvailableBalance(user.id, budgetId),
  ]);

  // Monthly totals
  const monthlyExpense = expenseTxns.reduce((sum, t) => sum + t.amount, 0);
  const monthlyIncome = incomeTxns.reduce((sum, t) => sum + t.amount, 0);

  // Spending per category this month
  const spentByCategory = new Map<number, number>();
  for (const t of expenseTxns) {
    if (t.categoryId != null) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
    }
  }

  // Top categories that have a monthly target
  const budgetCategories = categories
    .filter(c => c.monthlyTarget != null)
    .sort((a, b) => b.monthlyTarget! - a.monthlyTarget!)
    .slice(0, 4)
    .map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      color: c.color ?? null,
      spent: spentByCategory.get(c.id) ?? 0,
      target: c.monthlyTarget!,
    }));

  // Goals — accounts of type 'goal'
  const goals = accounts
    .filter(a => a.type === AccountTypes.Goal)
    .map(a => {
      const details = a.details as GoalAccountDetails | null;
      return {
        id: a.id,
        name: a.name,
        balance: a.balance,
        target: details?.targetAmount ?? 0,
      };
    })
    .filter(g => g.target > 0);

  const data: FinanceDashboardData = {
    hasBudget: true,
    budgetId,
    budgetName: budget.name,
    currency,
    availableBalance,
    monthlyIncome,
    monthlyExpense,
    categories: budgetCategories,
    goals,
    recentTransactions: recentTxns,
  };

  return data;
});
