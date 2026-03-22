import { McpServerName } from '@my-hub/shared/schema';
import { isMcpServerEnabled } from '@my-hub/shared/services';
import { PromiseCacheX } from 'promise-cachex';

const serverEnabledCache = new PromiseCacheX<boolean>({ ttl: 60_000 });

export const cachedIsMcpServerEnabled = async (userId: string, serverName: McpServerName) =>
  serverEnabledCache.get(`${userId}:${serverName}`, () => isMcpServerEnabled(userId, serverName));
