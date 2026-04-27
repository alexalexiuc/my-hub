/**
 * Zod schemas for apiary — used by both API routes and client pages.
 */
import { z } from 'zod';

export const ApiaryLogTypes = [
  'inspection',
  'treatment',
  'feeding',
  'harvest',
  'relocation',
  'queen_event',
  'note',
] as const;

export type ApiaryLogType = (typeof ApiaryLogTypes)[number];

export const HiveCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  yardId: z.number().int().positive().optional(),
  queenStatus: z.string().optional(),
  queenMarked: z.boolean().optional(),
  queenYear: z.number().int().optional(),
  boxes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type HiveCreateInput = z.infer<typeof HiveCreateSchema>;

export const HiveUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  yardId: z.number().int().positive().nullable().optional(),
  queenStatus: z.string().nullable().optional(),
  queenMarked: z.boolean().optional(),
  queenYear: z.number().int().nullable().optional(),
  boxes: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
});

export type HiveUpdateInput = z.infer<typeof HiveUpdateSchema>;

export const LogCreateSchema = z.object({
  type: z.enum(ApiaryLogTypes),
  hiveId: z.number().int().positive().optional(),
  loggedAt: z.string().optional(),
  notes: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type LogCreateInput = z.infer<typeof LogCreateSchema>;

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

export const TaskUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  hiveId: z.number().int().positive().nullable().optional(),
  yardId: z.number().int().positive().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  done: z.boolean().optional(),
});

export type TaskUpdateInput = z.infer<typeof TaskUpdateSchema>;

export const YardCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export type YardCreateInput = z.infer<typeof YardCreateSchema>;

export const YardUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type YardUpdateInput = z.infer<typeof YardUpdateSchema>;
