import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { supportedCurrencySchema } from '../currency.schema';
import {
  getAccounts,
  getNetWorthHistory,
  createAccount,
  addTransaction,
  getUserActiveBudget,
} from '@my-hub/shared/services';
import { AccountTypes, TransactionTypes } from '@my-hub/shared/constants';
import type { AccountType } from '@my-hub/shared/constants';
import type {
  BankAccountDetails,
  CreditCardAccountDetails,
  GoalAccountDetails,
  InvestmentAccountDetails,
  LoanAccountDetails,
  BorrowedLentAccountDetails,
  CashAccountDetails,
} from '@my-hub/shared/types';
import { accountsListResponseSchema, accountMutationResponseSchema, accountDetailsSchema } from '../contracts';
import type { AccountItem, AccountsListData } from '../contracts';
const AccountCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  description: z.string().trim().optional(),
  type: z.enum(Object.values(AccountTypes) as [string, ...string[]], { error: 'Invalid account type' }),
  currency: supportedCurrencySchema,
  openingBalance: z.number().optional(),
  details: accountDetailsSchema.nullable().optional(),
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

export const GET = route({ response: accountsListResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const liabilityTypes = new Set<string>([AccountTypes.Loan, AccountTypes.CreditCard]);

  const [rawAccounts, nwHistory] = await Promise.all([
    getAccounts(user.id, budgetId, { includeArchived: true }),
    getNetWorthHistory(user.id, budgetId, 6),
  ]);

  let netWorth = 0;
  const accounts: AccountItem[] = rawAccounts.map(a => {
    const bal = a.balance;
    if (!a.archived) netWorth += liabilityTypes.has(a.type) ? -bal : bal;
    return {
      id: a.id,
      name: a.name,
      description: a.description ?? null,
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

export const POST = route({ body: AccountCreateSchema, response: accountMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const balanceNum = body.openingBalance ?? 0;

  const account = await createAccount(user.id, budget.id, {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    type: body.type as AccountType,
    currency: body.currency,
    openingBalance: balanceNum,
    balance: balanceNum,
    archived: false,
    details: body.details ?? null,
  });

  if (balanceNum !== 0) {
    await addTransaction(user.id, budget.id, {
      type: balanceNum > 0 ? TransactionTypes.Income : TransactionTypes.Expense,
      accountId: account.id,
      toAccountId: null,
      amount: Math.abs(balanceNum),
      exchangeRate: 1,
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
