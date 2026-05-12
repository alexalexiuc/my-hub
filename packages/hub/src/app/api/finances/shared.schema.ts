import { z } from 'zod';

export const categoryIconSchema = z.string().nullable();
export const categoryColorSchema = z.string().nullable();
export const okResponseSchema = z.object({ ok: z.literal(true) });
