import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  createAccount,
  updateAccount,
  getAccountById,
  addTransaction,
  getMonthlyPayment,
  getLoanSummaryForAccount,
  buildLoanSummary,
} from '@my-hub/shared/services';
import { getAccountDetails } from '@my-hub/shared/types';
import { AccountTypes, LentDirections, TransactionTypes } from '@my-hub/shared/constants';
import { omitUndefined, currentDateString } from '@my-hub/shared/utils';
import { supportedCurrencySchema } from '../../shared/schemas';

// ─── upsert_account ───────────────────────────────────────────────────────────

export const UpsertAccountSchema = z.object({
  id: z.number().int().positive().optional().describe('Omit to create a new account.'),
  name: z.string().trim().min(1).optional().describe('Account display name. Required when creating.'),
  type: z
    .enum(AccountTypes)
    .optional()
    .describe(
      'Account type. Required when creating. One of: cash, bank, credit_card, investment, loan, borrowed_lent, tracking, goal.',
    ),
  currency: supportedCurrencySchema.optional().describe('Supported currency code (e.g. EUR, USD, MDL).'),
  openingBalance: z
    .number()
    .optional()
    .describe('Creates a balance-correction transaction on openingDate. Required together with openingDate.'),
  openingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Date for the opening balance transaction (YYYY-MM-DD). Required when openingBalance is provided.'),
  archived: z.boolean().optional().describe('Archive or unarchive the account.'),
  details: z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('bank'),
        interestRate: z.number().min(0).optional().describe('Savings interest rate in percent.'),
        savingsGoal: z.number().optional().describe('Savings goal amount.'),
        cardLastFour: z.string().length(4).optional().describe('Last four digits of the card.'),
        cardName: z.string().optional().describe('Card label or nickname.'),
      }),
      z.object({
        type: z.literal('cash'),
        savingsTarget: z.number().optional().describe('Cash savings target amount.'),
      }),
      z.object({
        type: z.literal('credit_card'),
        creditLimit: z.number().positive().describe('Credit limit amount.'),
        statementDay: z.number().int().min(1).max(31).describe('Statement closing day of month (1–31).'),
        cardLastFour: z.string().length(4).optional().describe('Last four digits of the card.'),
        cardName: z.string().optional().describe('Card label or nickname.'),
      }),
      z.object({
        type: z.literal('investment'),
        deposited: z.number().describe('Total amount deposited into this investment account.'),
      }),
      z.object({
        type: z.literal('loan'),
        principal: z.number().positive().describe('Original loan principal amount.'),
        interestRate: z
          .number()
          .min(0)
          .describe('Annual interest rate in percent (0 for interest-free installment plans).'),
        termMonths: z.number().int().positive().describe('Loan term in months.'),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe('Loan start date (YYYY-MM-DD).'),
        linkedItemName: z.string().optional().describe('Optional label for the purchased item.'),
      }),
      z.object({
        type: z.literal('borrowed_lent'),
        counterpartyName: z.string().min(1).describe('Name of the person you borrowed from or lent to.'),
        direction: z.enum(LentDirections).describe('"gave" = you lent money; "received" = you borrowed money.'),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Expected repayment date (YYYY-MM-DD).'),
        settled: z.boolean().optional().default(false).describe('Whether the debt has been settled.'),
      }),
      z.object({
        type: z.literal('goal'),
        targetAmount: z.number().positive().describe('Savings goal target amount.'),
      }),
      z.object({
        type: z.literal('tracking'),
      }),
    ])
    .optional()
    .describe(
      'Type-specific account details. The "type" field must match the account type. ' +
        'Required for: loan (principal, interestRate, termMonths, startDate), ' +
        'credit_card (creditLimit, statementDay), ' +
        'borrowed_lent (counterpartyName, direction), ' +
        'goal (targetAmount), ' +
        'investment (deposited).',
    ),
});

export const upsertAccountTool: ToolHandler<typeof UpsertAccountSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  if (input.openingBalance !== undefined && input.openingDate === undefined) {
    throw new HandledError('openingDate is required when openingBalance is provided');
  }
  if (input.openingDate !== undefined && input.openingBalance === undefined) {
    throw new HandledError('openingBalance is required when openingDate is provided');
  }
  if (input.details !== undefined && input.type !== undefined && input.details.type !== input.type) {
    throw new HandledError(`details.type "${input.details.type}" does not match account type "${input.type}"`);
  }

  const DETAILS_REQUIRED: string[] = ['credit_card', 'borrowed_lent', 'goal', 'investment'];

  let account;

  if (input.id !== undefined) {
    const existing = await getAccountById(userId, budget.id, input.id);
    if (!existing) throw new HandledError(`Account id ${input.id} not found`);

    account = await updateAccount(userId, budget.id, input.id, {
      name: input.name,
      type: input.type,
      currency: input.currency,
      archived: input.archived,
      ...(input.details !== undefined ? { details: input.details } : {}),
    });
  } else {
    if (!input.name) throw new HandledError('name is required when creating an account');
    if (!input.type) throw new HandledError('type is required when creating an account');
    if (input.type === AccountTypes.Loan) {
      throw new HandledError(
        'Use the finances_add_loan tool to create loan accounts. ' +
          'It sets the opening balance from the principal automatically.',
      );
    }
    if (DETAILS_REQUIRED.includes(input.type) && !input.details) {
      throw new HandledError(
        `details is required when creating a "${input.type}" account. ` +
          `Provide a details object with type="${input.type}" and the required fields.`,
      );
    }

    account = await createAccount(userId, budget.id, {
      name: input.name,
      type: input.type,
      currency: input.currency ?? budget.defaultCurrency,
      balance: 0,
      archived: input.archived ?? false,
      details: input.details ?? null,
    });
  }

  let openingTx = null;
  if (input.openingBalance !== undefined && input.openingDate !== undefined) {
    const amount = Math.abs(input.openingBalance);
    const txType = input.openingBalance >= 0 ? 'income' : 'expense';
    const date = input.openingDate;

    const tx = await addTransaction(userId, budget.id, {
      type: txType,
      amount,
      date,
      accountId: account.id,
      categoryId: null,
      payeeId: null,
      notes: 'Initial Balance',
      isCorrection: true,
      source: 'mcp',
    });

    openingTx = {
      transactionId: tx.id,
      type: txType,
      amount: input.openingBalance,
      date,
      balanceAfter: tx.fromAccountBalanceAfter,
    };
  }

  const finalAccount = openingTx != null ? await getAccountById(userId, budget.id, account.id) : account;

  const loanSummary =
    finalAccount!.type === AccountTypes.Loan ? await getLoanSummaryForAccount(userId, budget.id, finalAccount!) : null;

  return toolResponse({
    id: finalAccount!.id,
    name: finalAccount!.name,
    type: finalAccount!.type,
    currency: finalAccount!.currency,
    balance: finalAccount!.balance,
    archived: finalAccount!.archived,
    ...(openingTx ? { openingTransaction: openingTx } : {}),
    ...(loanSummary ? { loanSummary } : {}),
  });
};

// ─── add_loan ────────────────────────────────────────────────────────────────

export const AddLoanSchema = z.object({
  name: z.string().trim().min(1).describe('Account display name (e.g. "Car loan", "iPhone installment").'),
  currency: supportedCurrencySchema
    .optional()
    .describe('Supported currency code (e.g. EUR, USD, MDL). Defaults to the budget default currency.'),
  principal: z.number().positive().describe('Original loan amount disbursed.'),
  interestRate: z
    .number()
    .min(0)
    .describe('Annual interest rate in percent. Use 0 for interest-free installment plans.'),
  termMonths: z.number().int().positive().describe('Total loan term in months.'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Loan start / disbursement date (YYYY-MM-DD).'),
  linkedItemName: z.string().optional().describe('Optional label for the purchased item (e.g. "iPhone 15 Pro").'),
});

export const addLoanTool: ToolHandler<typeof AddLoanSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const account = await createAccount(userId, budget.id, {
    name: input.name,
    type: AccountTypes.Loan,
    currency: input.currency ?? budget.defaultCurrency,
    balance: 0,
    archived: false,
    details: {
      type: 'loan',
      principal: input.principal,
      interestRate: input.interestRate,
      termMonths: input.termMonths,
      startDate: input.startDate,
      ...(input.linkedItemName !== undefined ? { linkedItemName: input.linkedItemName } : {}),
    },
  });

  await addTransaction(userId, budget.id, {
    type: TransactionTypes.Expense,
    amount: input.principal,
    date: input.startDate,
    accountId: account.id,
    categoryId: null,
    payeeId: null,
    notes: 'Initial Balance',
    isCorrection: true,
    source: 'mcp',
  });

  const monthlyRate = input.interestRate / 100 / 12;
  const loanSummary = buildLoanSummary(getAccountDetails('loan', account.details), 0, currentDateString());
  return toolResponse(
    omitUndefined({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      principal: input.principal,
      interestRate: input.interestRate,
      termMonths: input.termMonths,
      startDate: input.startDate,
      monthlyPayment: Math.round(getMonthlyPayment(input.principal, monthlyRate, input.termMonths) * 100) / 100,
      linkedItemName: input.linkedItemName,
      loanSummary,
    }),
  );
};
