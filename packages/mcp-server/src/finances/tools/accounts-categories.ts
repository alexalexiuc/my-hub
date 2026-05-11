import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  createAccount,
  updateAccount,
  getAccountById,
  createCategory,
  updateCategory,
  getCategoryById,
  getGroups,
  createGroup,
  addTransaction,
} from '@my-hub/shared/services';
import { AccountTypes, CategoryIcons, LentDirections } from '@my-hub/shared/constants';
import { currentDateString } from '@my-hub/shared/utils';
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

  const DETAILS_REQUIRED: string[] = ['loan', 'credit_card', 'borrowed_lent', 'goal', 'investment'];

  let account;

  if (input.id !== undefined) {
    // Update existing
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
    // Create new
    if (!input.name) throw new HandledError('name is required when creating an account');
    if (!input.type) throw new HandledError('type is required when creating an account');
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
      openingBalance: 0,
      balance: 0,
      archived: input.archived ?? false,
      details: input.details ?? null,
    });
  }

  // Create opening balance correction transaction if requested
  let openingTx = null;
  if (input.openingBalance !== undefined && input.openingDate !== undefined) {
    const amount = Math.abs(input.openingBalance);
    const txType = input.openingBalance >= 0 ? 'income' : 'expense';
    const date = input.openingDate ?? currentDateString();

    const tx = await addTransaction(userId, budget.id, {
      type: txType,
      amount,
      date,
      accountId: account.id,
      categoryId: null,
      payeeId: null,
      notes: 'Opening balance',
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

  // Refresh account to get the updated balance after opening transaction
  const finalAccount = openingTx != null ? await getAccountById(userId, budget.id, account.id) : account;

  return toolResponse({
    id: finalAccount!.id,
    name: finalAccount!.name,
    type: finalAccount!.type,
    currency: finalAccount!.currency,
    balance: finalAccount!.balance,
    archived: finalAccount!.archived,
    ...(openingTx ? { openingTransaction: openingTx } : {}),
  });
};

// ─── upsert_category ──────────────────────────────────────────────────────────

const colorCodeSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    value =>
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
      /^[a-z]+$/i.test(value) ||
      /^[a-z][a-z-]*\(.+\)$/i.test(value),
    'Invalid color code. Use any valid CSS color code (e.g. #6ee7b7, rgb(...), hsl(...), oklch(...), red).',
  );

export const UpsertCategorySchema = z.object({
  id: z.number().int().positive().optional().describe('Omit to create a new category.'),
  name: z.string().trim().min(1).optional().describe('Category name. Required when creating.'),
  icon: z.enum(CategoryIcons).describe('Category icon key. Required.'),
  color: colorCodeSchema.describe('Category color code. Required; accepts any valid CSS color code.'),
  groupName: z
    .string()
    .min(1)
    .trim()
    .nullable()
    .optional()
    .describe('Name of the group (parent) for this category. null means ungrouped.'),
  monthlyTarget: z
    .number()
    .nullable()
    .optional()
    .describe('Monthly spending target in the budget default currency. null to remove the target.'),
});

export const upsertCategoryTool: ToolHandler<typeof UpsertCategorySchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  // Resolve groupName to groupId
  let groupId: number | null | undefined = undefined;
  if (input.groupName !== undefined) {
    if (input.groupName === null) {
      groupId = null;
    } else {
      const groups = await getGroups(userId, budget.id);
      const match = groups.find(g => g.name.toLowerCase() === input.groupName!.toLowerCase());
      if (match) {
        groupId = match.id;
      } else {
        const group = await createGroup(userId, budget.id, { name: input.groupName });
        groupId = group.id;
      }
    }
  }

  let category;

  if (input.id !== undefined) {
    // Update existing
    const existing = await getCategoryById(userId, budget.id, input.id);
    if (!existing) throw new HandledError(`Category id ${input.id} not found`);

    category = await updateCategory(userId, budget.id, input.id, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      groupId,
      monthlyTarget: input.monthlyTarget,
    });
  } else {
    // Create new
    if (!input.name) throw new HandledError('name is required when creating a category');

    category = await createCategory(userId, budget.id, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      groupId: groupId ?? null,
      monthlyTarget: input.monthlyTarget ?? null,
    });
  }

  // Get group name for response
  let groupName: string | null = null;
  if (category.groupId != null) {
    const groups = await getGroups(userId, budget.id);
    groupName = groups.find(g => g.id === category.groupId)?.name ?? null;
  }

  return toolResponse({
    id: category.id,
    name: category.name,
    group: groupName,
    monthlyTarget: category.monthlyTarget ?? null,
  });
};
