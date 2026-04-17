/**
 * API-level Zod schemas for apiary task endpoints.
 */
import { z } from 'zod';

export const TaskCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required'),
    hiveId: z.number().int().positive().optional(),
    yardId: z.number().int().positive().optional(),
    dueAt: z.string().optional(),
  })
  .refine(data => !(data.hiveId && data.yardId), {
    message: 'Provide hiveId or yardId, not both.',
    path: ['hiveId'],
  });

export type TaskCreateInput = z.infer<typeof TaskCreateSchema>;
