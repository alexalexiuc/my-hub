/**
 * API-level Zod schemas for apiary task endpoints.
 */
import { z } from 'zod';

export const TaskCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'title is required')
    .transform((s) => s.trim()),
  hive_id: z.number().int().positive().optional(),
  yard_id: z.number().int().positive().optional(),
  due_at: z.string().optional(),
});

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
