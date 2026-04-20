/**
 * API-level Zod schemas for user profile endpoints.
 */
import { z } from 'zod';

export const UpdateUserProfileSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  country: z.string().nullish(),
  timezone: z.string().nullish(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
