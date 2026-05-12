import { z } from 'zod';
import { supportedCurrencySchema } from '../currency.schema';

export const budgetMemberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  joinedAt: z.string(),
});

export const budgetInfoSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    defaultCurrency: supportedCurrencySchema,
    createdByUserId: z.string(),
    isOwner: z.boolean(),
    isActive: z.boolean().optional(),
  })
  .loose();

export type BudgetMember = z.infer<typeof budgetMemberSchema>;
export type BudgetInfo = z.infer<typeof budgetInfoSchema>;
