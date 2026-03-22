import { findUserById } from '@my-hub/shared/services';
import { PromiseCacheX } from 'promise-cachex';

const userCache = new PromiseCacheX<Awaited<ReturnType<typeof findUserById>>>({ ttl: 60_000 });

export const cachedFindUserById = async (userId: string) => userCache.get(userId, () => findUserById(userId));
