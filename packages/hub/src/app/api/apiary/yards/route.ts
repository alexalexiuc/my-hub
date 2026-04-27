import { route, created } from '@/lib/api/route';
import { getApiaryYards, createApiaryYard } from '@my-hub/shared/services';
import { YardCreateSchema } from '@/lib/schemas/apiary';

export const GET = route(async ({ user }) => {
  const yards = await getApiaryYards(user.id);
  return { yards };
});

export const POST = route({ body: YardCreateSchema })(async ({ user, body }) => {
  const yard = await createApiaryYard(user.id, {
    name: body.name.trim(),
    location: body.location ?? null,
    notes: body.notes ?? null,
  });
  return created({ yard });
});
