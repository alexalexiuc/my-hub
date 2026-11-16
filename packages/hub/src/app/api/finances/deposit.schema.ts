import { z } from 'zod';
import { DepositInstruments, DepositPayouts, DepositRateTypes, DepositStatuses } from '@my-hub/shared/constants';

/** Derived deposit figures (mirrors DepositSummary in @my-hub/shared/utils). */
export const depositSummarySchema = z.object({
  maturityDate: z.string(),
  daysToMaturity: z.number().int(),
  progressPercent: z.number(),
  expectedGrossInterest: z.number(),
  expectedTax: z.number(),
  expectedNetInterest: z.number(),
  interestReceivedToDate: z.number(),
  interestRemaining: z.number(),
  nextPayoutDate: z.string().nullable(),
  nextPayoutAmount: z.number().nullable(),
  effectiveNetYield: z.number(),
  projectedMaturityBalance: z.number(),
  overGuarantee: z.boolean(),
  guaranteeBreachDate: z.string().nullable(),
  maxPrincipalWithinGuarantee: z.number().nullable(),
  capitalizationDelta: z.number(),
  rateEstimated: z.boolean(),
  status: z.enum(DepositStatuses),
});

/** Editable deposit details (principal, dates and funding are fixed once the deposit is opened). */
export const depositDetailsFields = {
  institution: z.string().trim().min(1),
  productName: z.string().trim().optional(),
  instrument: z.enum(DepositInstruments),
  principal: z.number().positive(),
  interestRate: z.number().min(0),
  rateType: z.enum(DepositRateTypes),
  fixedMonths: z.number().int().positive().optional(),
  startDate: z.string(),
  termMonths: z.number().int().positive(),
  payout: z.enum(DepositPayouts),
  payoutAccountId: z.number().int().positive().optional(),
  returnAccountId: z.number().int().positive().optional(),
  taxRate: z.number().min(0).max(100),
  tranches: z.number().int().positive().optional(),
  earlyExitRule: z.string().optional(),
  autoRenew: z.boolean().optional(),
  guaranteeLimit: z.number().positive().optional(),
};

export const depositActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('recordInterest'),
    date: z.string().optional(),
    net: z.number().positive().optional(),
    tax: z.number().min(0).optional(),
    categoryId: z.number().int().positive().nullable().optional(),
  }),
  z.object({
    action: z.literal('close'),
    reason: z.enum(['matured', 'broken']),
    date: z.string().optional(),
    clawbackAmount: z.number().positive().optional(),
    returnAmount: z.number().positive().optional(),
    forfeitedAmount: z.number().positive().optional(),
  }),
]);

/** Report row for an active deposit (mirrors DepositProgress in the shared reports service). */
export const depositProgressSchema = z.object({
  accountId: z.number(),
  accountName: z.string(),
  currency: z.string(),
  principal: z.number(),
  maturityDate: z.string(),
  daysToMaturity: z.number(),
  interestReceivedToDate: z.number(),
  expectedNetInterest: z.number(),
});
