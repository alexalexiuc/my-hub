import { z } from 'zod';
import { supportedCurrencySchema } from '../../currency.schema';
import { categoryColorSchema, categoryIconSchema } from '../../shared.schema';
import { MAX_REPORT_YEAR, MIN_REPORT_YEAR } from '../reports.schema';

export const categorySpendingItemSchema = z.object({
  /** null for expenses recorded without a category. */
  categoryId: z.number().int().nullable(),
  name: z.string(),
  color: categoryColorSchema,
  icon: categoryIconSchema,
  spent: z.number(),
  transactionCount: z.number().int(),
});

export const categorySpendingResponseSchema = z.object({
  currency: supportedCurrencySchema,
  year: z.number().int(),
  totalSpent: z.number(),
  /** Highest spend first. */
  categories: z.array(categorySpendingItemSchema),
});

export const categorySpendingQuerySchema = z.object({
  /** Calendar year to report on. Defaults to the current year. */
  year: z.coerce.number().int().min(MIN_REPORT_YEAR).max(MAX_REPORT_YEAR).optional(),
});

export type CategorySpendingItem = z.infer<typeof categorySpendingItemSchema>;
export type CategorySpendingData = z.infer<typeof categorySpendingResponseSchema>;
