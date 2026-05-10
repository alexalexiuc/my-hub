import { z } from 'zod';
import { SupportedCurrencies } from '@my-hub/shared/constants';

export const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const supportedCurrencySchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.enum(SupportedCurrencies, { error: 'Unsupported currency' }));
