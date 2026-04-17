/**
 * API-level Zod schemas for todo endpoints.
 */
import { z } from 'zod';

export const TodoCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
});

export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;
