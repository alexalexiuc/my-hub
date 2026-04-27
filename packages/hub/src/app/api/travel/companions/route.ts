import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { addTripCompanion } from '@my-hub/shared/services';

const CompanionCreateSchema = z.object({
  tripId: z.number().int().positive('tripId is required'),
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const POST = route({ body: CompanionCreateSchema })(async ({ user, body }) => {
  const companion = await addTripCompanion(user.id, body.tripId, {
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    notes: body.notes ?? null,
  });
  return created({ companion });
});
