/**
 * API-level Zod schemas for apiary hive endpoints.
 */
import { z } from 'zod';

export const HiveCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .transform((s) => s.trim()),
  yard_id: z.number().int().positive().optional(),
  queen_status: z.string().optional(),
  queen_marked: z.boolean().optional(),
  queen_year: z.number().int().optional(),
  boxes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type HiveCreateInput = z.infer<typeof HiveCreateSchema>;
