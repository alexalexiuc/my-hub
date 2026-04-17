/**
 * API-level Zod schemas for todo endpoints.
 */
import { z } from 'zod';

export const TodoCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'title is required')
    .transform((s) => s.trim()),
});

export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;
