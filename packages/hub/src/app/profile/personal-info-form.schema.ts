import { z } from 'zod';

export const PersonalInfoFormSchema = z.object({
  name: z.string(),
  country: z.string(),
  timezone: z.string(),
});

export type PersonalInfoFormValues = z.infer<typeof PersonalInfoFormSchema>;
