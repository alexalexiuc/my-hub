import { findUserById } from '@my-hub/shared/services';
import { User } from '@my-hub/shared/types';
import { PromiseCacheX } from 'promise-cachex';

const userCache = new PromiseCacheX<User | undefined>({ ttl: 60_000 });

export const cachedFindUserById = async (userId: string) => userCache.get(userId, () => findUserById(userId));
