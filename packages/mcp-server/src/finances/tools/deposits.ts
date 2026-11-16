import { z } from 'zod';
import { HandledError } from '../../shared/errors';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  getAccountById,
  openDeposit,
  recordDepositInterest,
  closeDeposit,
  getDepositSummaryForAccount,
} from '@my-hub/shared/services';
import { getAccountDetails } from '@my-hub/shared/types';
import {
  DEFAULT_DEPOSIT_TAX_RATE,
  DepositInstruments,
  DepositPayouts,
  DepositRateTypes,
} from '@my-hub/shared/constants';
import { buildDepositSchedule } from '@my-hub/shared/utils';
import { supportedCurrencySchema } from '../../shared/schemas';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ─── add_deposit ──────────────────────────────────────────────────────────────

export const AddDepositSchema = z.object({
  name: z.string().trim().min(1).describe('Account display name (e.g. "MICB Maestro Online").'),
  currency: supportedCurrencySchema
    .optional()
    .describe('Currency of the deposit. Defaults to the budget default currency.'),
  institution: z.string().trim().min(1).describe('Bank or issuer (e.g. "MICB").'),
  productName: z.string().optional().describe('Product name (e.g. "Maestro Online").'),
  instrument: z
    .enum(DepositInstruments)
    .optional()
    .describe('bank_deposit (default) or state_bond. Sets the default tax rate (6% vs 0%).'),
  principal: z.number().positive().describe('Amount placed, in the deposit currency.'),
  interestRate: z.number().min(0).describe('Annual nominal interest rate in percent.'),
  rateType: z
    .enum(DepositRateTypes)
    .optional()
    .describe('fixed (default), fixed_then_floating or floating. Only fixed is computed exactly.'),
  fixedMonths: z.number().int().positive().optional().describe('Months the rate is fixed; for fixed_then_floating.'),
  startDate: isoDate.describe('Date the deposit starts (YYYY-MM-DD); also the date of the funding transfer.'),
  termMonths: z.number().int().positive().describe('Term in months. Maturity = startDate + termMonths.'),
  payout: z
    .enum(DepositPayouts)
    .describe('When interest is paid: monthly, quarterly, semiannual, at_maturity or capitalized (added to balance).'),
  payoutAccountId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Account receiving net interest. Required unless payout is capitalized.'),
  returnAccountId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Account receiving the principal at maturity. Defaults to payoutAccountId.'),
  taxRate: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Tax withheld at source, percent. Defaults to 6 for bank deposits, 0 for state bonds.'),
  tranches: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('How many identical bank deposits this account represents.'),
  earlyExitRule: z.string().optional().describe('Free text, e.g. "lose all interest, paid interest clawed back".'),
  autoRenew: z.boolean().optional(),
  guaranteeLimit: z.number().positive().optional().describe('Deposit guarantee limit; flagged when exceeded.'),
  sourceAccountId: z.number().int().positive().describe('Account the principal is moved from (funding transfer).'),
  sourceAmount: z
    .number()
    .positive()
    .optional()
    .describe('Amount leaving the source account in ITS currency. Required when currencies differ.'),
});

export const addDepositTool: ToolHandler<typeof AddDepositSchema.shape> = async (input, context) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const instrument = input.instrument ?? DepositInstruments.BankDeposit;
  const { name, currency, sourceAccountId, sourceAmount, ...rest } = input;
  const details = {
    ...rest,
    instrument,
    rateType: input.rateType ?? DepositRateTypes.Fixed,
    taxRate: input.taxRate ?? DEFAULT_DEPOSIT_TAX_RATE[instrument],
  };

  const { account, fundingTransactionId } = await openDeposit(userId, budget.id, {
    name,
    currency: currency ?? budget.defaultCurrency,
    details,
    sourceAccountId,
    sourceAmount,
  });

  const stored = getAccountDetails('deposit', account.details)!;
  const depositSummary = await getDepositSummaryForAccount(userId, budget.id, account);
  return toolResponse({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    fundingTransactionId,
    depositSummary,
    schedule: buildDepositSchedule(stored),
  });
};

// ─── record_deposit_interest ──────────────────────────────────────────────────

export const RecordDepositInterestSchema = z.object({
  depositAccountId: z.number().int().positive().describe('ID of the deposit account (see finances_list_context).'),
  date: isoDate.optional().describe('Payout date (YYYY-MM-DD). Defaults to today.'),
  net: z
    .number()
    .positive()
    .optional()
    .describe('Net interest actually received. Omit to use the next scheduled payout not yet recorded.'),
  tax: z.number().min(0).optional().describe('Tax withheld. Omit to use the scheduled share.'),
  categoryId: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe('Income category. Omit to use a category named "Interest" if one exists; null for none.'),
  notes: z.string().optional(),
});

export const recordDepositInterestTool: ToolHandler<typeof RecordDepositInterestSchema.shape> = async (
  { depositAccountId, ...input },
  context,
) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const result = await recordDepositInterest(userId, budget.id, depositAccountId, input);
  const account = await getAccountById(userId, budget.id, depositAccountId);
  return toolResponse({
    transactionId: result.transaction.id,
    gross: result.gross,
    tax: result.tax,
    net: result.net,
    depositSummary: account ? await getDepositSummaryForAccount(userId, budget.id, account) : null,
  });
};

// ─── close_deposit ────────────────────────────────────────────────────────────

export const CloseDepositSchema = z.object({
  depositAccountId: z.number().int().positive().describe('ID of the deposit account (see finances_list_context).'),
  reason: z.enum(['matured', 'broken']).describe('matured: held to term. broken: closed early.'),
  date: isoDate.optional().describe('Date of the return (YYYY-MM-DD). Defaults to today.'),
  clawbackAmount: z
    .number()
    .positive()
    .optional()
    .describe('Broken early: interest the bank clawed back, recorded as an expense on the return account.'),
  returnAmount: z
    .number()
    .positive()
    .optional()
    .describe('Amount credited to the return account in ITS currency. Required when currencies differ.'),
});

export const closeDepositTool: ToolHandler<typeof CloseDepositSchema.shape> = async (
  { depositAccountId, ...input },
  context,
) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const { account, returnedAmount, returnTransactionId } = await closeDeposit(
    userId,
    budget.id,
    depositAccountId,
    input,
  );
  return toolResponse({
    id: account.id,
    name: account.name,
    status: getAccountDetails('deposit', account.details)?.status,
    archived: account.archived,
    returnedAmount,
    currency: account.currency,
    returnTransactionId,
  });
};
