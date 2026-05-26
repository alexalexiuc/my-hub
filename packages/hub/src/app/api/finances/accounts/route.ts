import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  getAccounts,
  getNetWorthHistory,
  getAvailabilityPreferences,
  isIncludedInAvailable,
  LIABILITY_TYPES,
  createAccount,
  addTransaction,
  getUserActiveBudget,
  getLoanBalanceSnapshotForAccount,
} from '@my-hub/shared/services';
import { AccountTypes, LentDirections, TransactionTypes } from '@my-hub/shared/constants';
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
import { supportedCurrencySchema } from '../currency.schema';

export const accountDetailsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(AccountTypes.Bank),
    interestRate: z.number().optional(),
    savingsGoal: z.number().optional(),
    cardLastFour: z.string().optional(),
    cardName: z.string().optional(),
  }),
  z.object({ type: z.literal(AccountTypes.Cash), savingsTarget: z.number().optional() }),
  z.object({
    type: z.literal(AccountTypes.CreditCard),
    creditLimit: z.number(),
    statementDay: z.number().int().min(1).max(31),
    cardLastFour: z.string().optional(),
    cardName: z.string().optional(),
  }),
  z.object({ type: z.literal(AccountTypes.Investment), deposited: z.number() }),
  z.object({
    type: z.literal(AccountTypes.Loan),
    principal: z.number(),
    interestRate: z.number(),
    termMonths: z.number().int(),
    startDate: z.string(),
    linkedItemName: z.string().optional(),
  }),
  z.object({
    type: z.literal(AccountTypes.BorrowedLent),
    counterpartyName: z.string(),
    direction: z.enum(LentDirections),
    dueDate: z.string().optional(),
    settled: z.boolean(),
  }),
  z.object({ type: z.literal(AccountTypes.Goal), targetAmount: z.number() }),
  z.object({ type: z.literal(AccountTypes.Tracking) }),
]);

export const accountItemSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    type: z.enum(AccountTypes),
    currency: supportedCurrencySchema,
    balance: z.number(),
    archived: z.boolean(),
    creditLimit: z.number().optional(),
    statementDay: z.number().optional(),
    cardLastFour: z.string().optional(),
    cardName: z.string().optional(),
    targetAmount: z.number().optional(),
    deposited: z.number().optional(),
    principal: z.number().optional(),
    interestRate: z.number().optional(),
    termMonths: z.number().optional(),
    startDate: z.string().optional(),
    linkedItemName: z.string().optional(),
    counterpartyName: z.string().optional(),
    direction: z.enum(LentDirections).optional(),
    dueDate: z.string().optional(),
    settled: z.boolean().optional(),
    includedInAvailable: z.boolean(),
    amortizationSummary: z
      .object({
        monthlyPayment: z.number(),
        paymentsMade: z.number().int(),
        paymentsRemaining: z.number().int(),
        remainingPrincipal: z.number(),
        totalInterestPaid: z.number(),
        totalInterestRemaining: z.number(),
        totalCost: z.number(),
        scheduledPayoffDate: z.string(),
        actualPayoffDate: z.string().optional(),
        interestSavedVsSchedule: z.number().optional(),
      })
      .optional(),
  })
  .loose();

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  description: z.string().trim().optional(),
  type: z.enum(Object.values(AccountTypes) as [string, ...string[]], { error: 'Invalid account type' }),
  currency: supportedCurrencySchema,
  openingBalance: z.number().optional(),
  details: accountDetailsSchema.nullable().optional(),
});

export const accountsListResponseSchema = z.object({
  currency: supportedCurrencySchema,
  availableBalance: z.number(),
  netWorth: z.number(),
  netWorthHistory: z.array(z.number()),
  accounts: z.array(accountItemSchema),
});

export const accountMutationResponseSchema = z.object({
  account: z.object({ id: z.number().int() }).loose(),
});

export type AccountItem = z.infer<typeof accountItemSchema>;
export type AccountsListData = z.infer<typeof accountsListResponseSchema>;
export type AccountCreateData = z.infer<typeof accountCreateSchema>;
export type AccountDetails = z.infer<typeof accountDetailsSchema>;
export type AccountMutationResponse = z.infer<typeof accountMutationResponseSchema>;

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

  const [rawAccounts, nwHistory, prefs] = await Promise.all([
    getAccounts(user.id, budgetId, { includeArchived: true }),
    getNetWorthHistory(user.id, budgetId, 6),
    getAvailabilityPreferences(user.id, budgetId),
  ]);

  const accountCurrencyById = new Map(rawAccounts.map(account => [account.id, account.currency]));

  let netWorth = 0;
  let availableBalance = 0;
  const accounts: AccountItem[] = await Promise.all(
    rawAccounts.map(async account => {
      const isLoan = account.type === AccountTypes.Loan;
      const loanSnapshot = isLoan
        ? await getLoanBalanceSnapshotForAccount(user.id, budgetId, account, { accountCurrencyById })
        : null;
      // For loans, use the amortization-derived remaining principal (positive) as the display
      // balance. This matches what the MCP context tool returns and correctly reflects how much
      // principal still needs to be repaid, independent of the interest included in each payment.
      const bal = loanSnapshot ? loanSnapshot.balance : account.balance;
      const isOtherLiability = !isLoan && LIABILITY_TYPES.has(account.type);
      const includedInAvailable = isIncludedInAvailable(account.type, prefs.get(account.id) ?? null);
      if (!account.archived) {
        // Loans: positive remaining principal must be subtracted from net worth (it's a liability).
        // Other liabilities and assets keep the existing sign convention.
        netWorth += isLoan || isOtherLiability ? -bal : bal;
        if (includedInAvailable) availableBalance += isLoan || isOtherLiability ? -bal : bal;
      }
      return {
        id: account.id,
        name: account.name,
        description: account.description ?? null,
        type: account.type,
        currency: account.currency,
        balance: bal,
        archived: account.archived,
        includedInAvailable,
        ...flattenDetails(account.type, account.details),
        ...(loanSnapshot ? { amortizationSummary: loanSnapshot.amortizationSummary } : {}),
      };
    }),
  );

  const netWorthHistory = nwHistory.length > 0 ? nwHistory.map(s => s.netWorth) : [netWorth];

  const data: AccountsListData = {
    currency: budget.defaultCurrency,
    availableBalance,
    netWorth,
    netWorthHistory,
    accounts,
  };

  return data;
});

export const POST = route({ body: accountCreateSchema, response: accountMutationResponseSchema })(async ({
  user,
  body,
}) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const isLoan = body.type === AccountTypes.Loan;
  const openingBal = isLoan ? -((body.details as LoanAccountDetails).principal ?? 0) : (body.openingBalance ?? 0);

  const account = await createAccount(user.id, budget.id, {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    type: body.type as AccountType,
    currency: body.currency,
    balance: 0,
    archived: false,
    details: body.details ?? null,
  });

  if (openingBal !== 0) {
    await addTransaction(user.id, budget.id, {
      type: openingBal > 0 ? TransactionTypes.Income : TransactionTypes.Expense,
      accountId: account.id,
      toAccountId: null,
      amount: Math.abs(openingBal),
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
