import { route } from '@/lib/api/route';
import { getMeasurementTypes } from '@my-hub/shared/services';

export const GET = route(async () => {
  const types = await getMeasurementTypes();
  return { types };
});
