import { CategoryIcons } from '@my-hub/shared/constants';
import { z } from 'zod';

export const categoryIconSchema = z.enum(CategoryIcons).nullable();
export const categoryColorSchema = z.string().nullable();
export const okResponseSchema = z.object({ ok: z.literal(true) });
