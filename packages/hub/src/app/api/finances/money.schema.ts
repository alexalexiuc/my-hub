import { z } from 'zod';

/** An amount paired with the currency it's denominated in — mirrors shared `MoneyAmount`. */
export const moneyAmountSchema = z.object({ amount: z.number(), currency: z.string() });
