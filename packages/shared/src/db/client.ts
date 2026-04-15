import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/';
import { sharedEnvConfig } from '../config/env';

function createDb() {
  const connectionString = sharedEnvConfig.DATABASE_URL;

  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

type DbClient = ReturnType<typeof createDb>;

// Cache a single DB client for the process lifetime.
let dbInstance: DbClient | undefined;

export function getDb(): DbClient {
  // Reason: Next.js build imports server modules; eager DB init made builds fail when DATABASE_URL was not set at import time.
  // Initialize on first use so module import itself does not require DATABASE_URL.
  dbInstance ??= createDb();
  return dbInstance;
}

// Keep `db` import API unchanged while deferring actual client creation until access time.
export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = instance[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
}) as DbClient;

export type Db = DbClient;
