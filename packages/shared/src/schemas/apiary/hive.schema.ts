/**
 * API-level Zod schemas for apiary hive endpoints.
 */
import { z } from 'zod';

export const HiveCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .transform(s => s.trim()),
  yardId: z.number().int().positive().optional(),
  queenStatus: z.string().optional(),
  queenMarked: z.boolean().optional(),
  queenYear: z.number().int().optional(),
  boxes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type HiveCreateInput = z.infer<typeof HiveCreateSchema>;
