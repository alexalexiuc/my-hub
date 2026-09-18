import { buildProfileSnapshot } from '../models/profile';
import { ResourceHandler } from '../../shared/types';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getProfileResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;

  return resourceResponse(uri, await buildProfileSnapshot(userId));
};
