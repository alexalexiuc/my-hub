import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
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

export const GET = withAuth(async ({ user }) => {
  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

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

  return NextResponse.json(data);
});

const VALID_TYPES = new Set<AccountType>(Object.values(AccountTypes));

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, type, currency, openingBalance, details } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (typeof type !== 'string' || !VALID_TYPES.has(type as AccountType)) {
    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
  }
  if (typeof currency !== 'string' || !currency.trim()) {
    return NextResponse.json({ error: 'currency is required' }, { status: 400 });
  }

  const balanceNum = typeof openingBalance === 'number' ? openingBalance : 0;
  const balStr = balanceNum.toFixed(4);

  const budgets = await getUserBudgets(user.id);
  const budget = budgets[0];
  if (!budget) return NextResponse.json({ error: 'No budget found' }, { status: 404 });

  const account = await createAccount(user.id, budget.id, {
    name: name.trim(),
    type: type as AccountType,
    currency: currency.trim().toUpperCase(),
    openingBalance: balStr,
    balance: balStr,
    archived: false,
    details: details && typeof details === 'object' ? details : null,
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

  return NextResponse.json({ account }, { status: 201 });
});
