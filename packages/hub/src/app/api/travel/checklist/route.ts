import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { addChecklistItem } from '@my-hub/shared/services';

const ChecklistCreateSchema = z.object({
  tripId: z.number().int().positive('tripId is required'),
  title: z.string().trim().min(1, 'title is required'),
});

export const POST = route({ body: ChecklistCreateSchema })(async ({ user, body }) => {
  const item = await addChecklistItem(user.id, body.tripId, { title: body.title, done: false });
  return created({ item });
});
