/**
 * API-level Zod schemas for apiary log endpoints.
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

export const LogCreateSchema = z.object({
  type: z.enum(ApiaryLogTypes),
  hiveId: z.number().int().positive().optional(),
  loggedAt: z.string().optional(),
  notes: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export type LogCreateInput = z.infer<typeof LogCreateSchema>;
