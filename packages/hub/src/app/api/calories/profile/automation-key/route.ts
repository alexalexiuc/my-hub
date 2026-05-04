import { z } from 'zod';
import { route } from '@/lib/api/route';
import { generateCaloriesAutomationKey } from '@my-hub/shared/services';

const GenerateAutomationKeyResponseSchema = z.object({
  automationApiKey: z.string(),
});

export const POST = route({ response: GenerateAutomationKeyResponseSchema })(async ({ user }) => {
  const automationApiKey = await generateCaloriesAutomationKey(user.id);
  return { automationApiKey };
});
