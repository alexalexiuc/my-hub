import { ResourceHandler } from '../../shared/types';
import { getApiaryTasks, getApiaryHives } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getTasksResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const [tasks, hives] = await Promise.all([getApiaryTasks(userId, { completed: false }), getApiaryHives(userId)]);

  const hiveMap = new Map(hives.map(h => [h.id, h.name]));
  const enriched = tasks.map(t => ({
    ...t,
    hiveName: t.hiveId ? (hiveMap.get(t.hiveId) ?? null) : null,
  }));

  return resourceResponse(uri, { tasks: enriched, count: enriched.length });
};
