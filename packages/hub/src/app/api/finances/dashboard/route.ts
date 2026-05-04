import { route } from '@/lib/api/route';
import {
  getAccounts,
  getCategories,
  getPayees,
  getTransactions,
  getNetWorthHistory,
  getUserActiveBudget,
  getUserBudgets,
} from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import type { GoalAccountDetails } from '@my-hub/shared/constants';
import { dashboardResponseSchema } from '../contracts';
import type { FinanceDashboardData } from '../contracts';

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

  const [accounts, categories, payees, expenseTxns, incomeTxns, recentTxns, nwHistory] = await Promise.all([
    getAccounts(user.id, budgetId),
    getCategories(user.id, budgetId),
    getPayees(user.id, budgetId),
    getTransactions(user.id, budgetId, { type: 'expense', fromDate: monthStart, toDate: today, limit: 2000 }),
    getTransactions(user.id, budgetId, { type: 'income', fromDate: monthStart, toDate: today, limit: 2000 }),
    getTransactions(user.id, budgetId, { limit: 5 }),
    getNetWorthHistory(user.id, budgetId, 6),
  ]);

  // Net worth: assets minus liabilities
  const liabilityTypes = new Set<string>([AccountTypes.Loan, AccountTypes.CreditCard]);
  let netWorth = 0;
  for (const acc of accounts) {
    const bal = acc.balance;
    netWorth += liabilityTypes.has(acc.type) ? -bal : bal;
  }

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

  // Recent transactions enriched with category + payee names
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const payeeMap = new Map(payees.map(p => [p.id, p]));

  const recentTransactions = recentTxns.map(t => {
    const cat = t.categoryId != null ? categoryMap.get(t.categoryId) : undefined;
    const payee = t.payeeId != null ? payeeMap.get(t.payeeId) : undefined;
    return {
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      notes: t.notes ?? null,
      payeeName: payee?.name ?? null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      categoryIcon: cat?.icon ?? null,
    };
  });

  // Net worth sparkline: use snapshots if available, else single current point
  const netWorthHistory = nwHistory.length > 0 ? nwHistory.map(s => s.netWorth) : [netWorth];

  const data: FinanceDashboardData = {
    hasBudget: true,
    budgetId,
    budgetName: budget.name,
    currency,
    netWorth,
    netWorthHistory,
    monthlyIncome,
    monthlyExpense,
    categories: budgetCategories,
    goals,
    recentTransactions,
  };

  return data;
});
