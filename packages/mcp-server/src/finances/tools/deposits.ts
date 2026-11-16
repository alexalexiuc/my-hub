import { z } from 'zod';
import { HandledError } from '../../shared/errors';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  getAccountById,
  openDeposit,
  updateDepositMode,
  recordDepositInterest,
  closeDeposit,
  getDepositSummaryForAccount,
} from '@my-hub/shared/services';
import { getAccountDetails } from '@my-hub/shared/types';
import {
  DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY,
  DEFAULT_DEPOSIT_TAX_RATE,
  DepositCapitalizationFrequencies,
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
    .describe(
      'When interest is paid: monthly, quarterly, semiannual, at_maturity, or capitalized (net interest is credited to the deposit and earns interest).',
    ),
  capitalizationFrequency: z
    .enum(DepositCapitalizationFrequencies)
    .optional()
    .describe('Only with payout capitalized: monthly (default), quarterly or at_maturity.'),
  reinvestRate: z
    .number()
    .min(0)
    .optional()
    .describe(
      'Optional assumed annual % (e.g. 2 for a savings account) on interest paid out, used by depositSummary.capitalizationDelta.',
    ),
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
    capitalizationFrequency:
      input.payout === DepositPayouts.Capitalized
        ? (input.capitalizationFrequency ?? DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY)
        : input.capitalizationFrequency,
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
    capitalized: result.capitalized,
    creditedTo: result.capitalized ? 'the deposit itself (balance grew)' : 'the payout account',
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
    .describe(
      'Same currency as the deposit: the amount the bank actually returns. Less than the balance means the bank keeps the rest ' +
        '(forfeited interest, booked as an Interest expense so the deposit reaches 0). ' +
        'Different currency: the amount credited to the return account in ITS currency.',
    ),
  forfeitedAmount: z
    .number()
    .positive()
    .optional()
    .describe(
      'Part of the balance the bank keeps, in the deposit currency. Only needed when the return account is in another currency; broken deposits only.',
    ),
});

export const closeDepositTool: ToolHandler<typeof CloseDepositSchema.shape> = async (
  { depositAccountId, ...input },
  context,
) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const { account, returnedAmount, returnTransactionId, forfeitedAmount, forfeitedTransactionId } = await closeDeposit(
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
    forfeitedAmount,
    currency: account.currency,
    returnTransactionId,
    ...(forfeitedTransactionId != null ? { forfeitedTransactionId } : {}),
  });
};

// ─── update_deposit ───────────────────────────────────────────────────────────

export const UpdateDepositSchema = z.object({
  depositAccountId: z.number().int().positive().describe('ID of the deposit account (see finances_list_context).'),
  effectiveDate: isoDate
    .optional()
    .describe('Date the change takes effect (YYYY-MM-DD). Defaults to today. Earlier periods keep their old mode.'),
  payout: z
    .enum(DepositPayouts)
    .optional()
    .describe('New payout mode, e.g. capitalized to turn capitalization on or monthly to turn it off.'),
  capitalizationFrequency: z
    .enum(DepositCapitalizationFrequencies)
    .optional()
    .describe('New capitalization frequency (only with payout capitalized).'),
  payoutAccountId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Account receiving net interest. Required when switching to a paid-out mode and none is set.'),
  reinvestRate: z
    .number()
    .min(0)
    .nullable()
    .optional()
    .describe('Assumed annual % on paid-out interest for capitalizationDelta; null clears it.'),
});

export const updateDepositTool: ToolHandler<typeof UpdateDepositSchema.shape> = async (
  { depositAccountId, ...input },
  context,
) => {
  const { userId } = context;
  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const { account, effectiveDate, summary, schedule } = await updateDepositMode(
    userId,
    budget.id,
    depositAccountId,
    input,
  );
  return toolResponse({
    id: account.id,
    name: account.name,
    effectiveDate,
    depositSummary: summary,
    schedule,
  });
};
