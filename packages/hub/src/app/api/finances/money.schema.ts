import { z } from 'zod';

/** An amount paired with the currency it's denominated in — mirrors shared `MoneyAmount`. */
export const moneyAmountSchema = z.object({ amount: z.number(), currency: z.string() });

/**
 * A balance converted into the budget currency at the current rate — mirrors shared
 * `AccountBalanceConversion`. All null when no rate is known (the balance is then left out of totals).
 */
export const balanceConversionSchema = z.object({
  balanceInDefaultCurrency: z.number().nullable(),
  rate: z.number().nullable(),
  rateDate: z.string().nullable(),
});

export type BalanceConversion = z.infer<typeof balanceConversionSchema>;
