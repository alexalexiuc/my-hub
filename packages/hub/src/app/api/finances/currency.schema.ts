import { SupportedCurrencies } from '@my-hub/shared/constants';
import { z } from 'zod';

export const supportedCurrencySchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .pipe(z.enum(SupportedCurrencies, { error: 'Unsupported currency' }));
