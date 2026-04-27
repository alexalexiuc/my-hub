import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  getUserBudgets,
  getAccounts,
  getNetWorthHistory,
  createAccount,
  addTransaction,
} from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import type {
  BankAccountDetails,
  CreditCardAccountDetails,
  GoalAccountDetails,
  InvestmentAccountDetails,
  LoanAccountDetails,
  BorrowedLentAccountDetails,
  CashAccountDetails,
} from '@my-hub/shared/constants';
import type { AccountItem, AccountsListData } from '@/app/finances/accounts/types';
const AccountCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  type: z.enum(Object.values(AccountTypes) as [string, ...string[]], { error: 'Invalid account type' }),
  currency: z.string().trim().min(1, 'currency is required'),
  openingBalance: z.number().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
});

function flattenDetails(type: string, details: unknown): Partial<AccountItem> {
  if (!details || typeof details !== 'object') return {};
  switch (type) {
    case AccountTypes.Bank: {
      const d = details as BankAccountDetails;
      return { cardLastFour: d.cardLastFour, cardName: d.cardName };
    }
    case AccountTypes.CreditCard: {
      const d = details as CreditCardAccountDetails;
      return {
        creditLimit: d.creditLimit,
        statementDay: d.statementDay,
        cardLastFour: d.cardLastFour,
        cardName: d.cardName,
      };
    }
    case AccountTypes.Goal: {
      const d = details as GoalAccountDetails;
      return { targetAmount: d.targetAmount };
    }
    case AccountTypes.Investment: {
      const d = details as InvestmentAccountDetails;
      return { deposited: d.deposited };
    }
    case AccountTypes.Loan: {
      const d = details as LoanAccountDetails;
      return {
        principal: d.principal,
        interestRate: d.interestRate,
        termMonths: d.termMonths,
        startDate: d.startDate,
        linkedItemName: d.linkedItemName,
      };
    }
    case AccountTypes.BorrowedLent: {
      const d = details as BorrowedLentAccountDetails;
      return { counterpartyName: d.counterpartyName, direction: d.direction, dueDate: d.dueDate, settled: d.settled };
    }
    case AccountTypes.Cash: {
      const d = details as CashAccountDetails;
      return { targetAmount: d.savingsTarget };
    }
    default:
      return {};
  }
}

export const GET = route(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const liabilityTypes = new Set<string>([AccountTypes.Loan, AccountTypes.CreditCard]);

  const [rawAccounts, nwHistory] = await Promise.all([
    getAccounts(user.id, budgetId),
    getNetWorthHistory(user.id, budgetId, 6),
  ]);

  let netWorth = 0;
  const accounts: AccountItem[] = rawAccounts.map(a => {
    const bal = parseFloat(a.balance);
    netWorth += liabilityTypes.has(a.type) ? -bal : bal;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: bal,
      archived: a.archived,
      ...flattenDetails(a.type, a.details),
    };
  });

  const netWorthHistory = nwHistory.length > 0 ? nwHistory.map(s => s.netWorth) : [netWorth];

  const data: AccountsListData = {
    currency: budget.defaultCurrency,
    netWorth,
    netWorthHistory,
    accounts,
  };

  return data;
});

export const POST = route({ body: AccountCreateSchema })(async ({ user, body }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const balanceNum = body.openingBalance ?? 0;
  const balStr = balanceNum.toFixed(4);

  const account = await createAccount(user.id, budget.id, {
    name: body.name.trim(),
    type: body.type as AccountType,
    currency: body.currency.trim().toUpperCase(),
    openingBalance: balStr,
    balance: balStr,
    archived: false,
    details: body.details ?? null,
  });

  if (balanceNum !== 0) {
    await addTransaction(user.id, budget.id, {
      type: balanceNum > 0 ? 'income' : 'expense',
      accountId: account.id,
      toAccountId: null,
      amount: String(Math.abs(balanceNum)),
      exchangeRate: '1',
      date: new Date().toISOString().slice(0, 10),
      categoryId: null,
      payeeId: null,
      notes: 'Initial Balance',
      isCorrection: true,
      fromAccountBalanceAfter: null,
      toAccountBalanceAfter: null,
      extras: null,
    });
  }

  return created({ account });
});
