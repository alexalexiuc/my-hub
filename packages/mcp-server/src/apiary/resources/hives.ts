import { ResourceHandler } from '../../shared/types';
import { getApiaryHives, getApiaryYards } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getHivesResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const [hives, yards] = await Promise.all([getApiaryHives(userId, { active: true }), getApiaryYards(userId)]);

  const yardMap = new Map(yards.map(y => [y.id, y.name]));
  const enriched = hives.map(h => ({
    ...h,
    yardName: h.yardId ? (yardMap.get(h.yardId) ?? null) : null,
  }));

  return resourceResponse(uri, { hives: enriched, count: enriched.length });
};
