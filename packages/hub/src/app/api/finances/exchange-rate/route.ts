import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getExchangeRateQuote } from '@my-hub/shared/services';
import { isoDateSchema } from '@/lib/schemas/common';
import { supportedCurrencySchema } from '../currency.schema';

const ExchangeRateQuerySchema = z.object({
  from: supportedCurrencySchema,
  to: supportedCurrencySchema,
  date: isoDateSchema,
});

export const exchangeRateResponseSchema = z.object({
  /** 1 `from` = rate × `to`; null when no rate is available for that date (enter it manually). */
  rate: z.number().nullable(),
  rateDate: z.string().nullable(),
});

export type ExchangeRateResponse = z.infer<typeof exchangeRateResponseSchema>;

/** Market rate used to prefill the transaction form's rate field — the same lookup the server applies when no rate is entered. */
export const GET = route({ query: ExchangeRateQuerySchema, response: exchangeRateResponseSchema })(async ({
  query,
}) => {
  try {
    const quote = await getExchangeRateQuote(query.from, query.to, query.date);
    return { rate: quote.rate, rateDate: quote.rateDate };
  } catch {
    return { rate: null, rateDate: null };
  }
});
