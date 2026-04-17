/**
 * API-level Zod schemas for trip endpoints.
 */
import { z } from 'zod';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Must be a hex color (#RRGGBB)')
  .optional();

export const TripCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'name is required')
    .transform(s => s.trim()),
  destination: z.string().optional(),
  color: hexColorSchema,
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  notes: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

export type TripCreateInput = z.infer<typeof TripCreateSchema>;

export const TripUpdateSchema = z.object({
  name: z
    .string()
    .min(1)
    .transform(s => s.trim())
    .optional(),
  destination: z.string().optional(),
  color: hexColorSchema,
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  notes: z.string().optional(),
  coverImageUrl: z.string().optional(),
});

export type TripUpdateInput = z.infer<typeof TripUpdateSchema>;
