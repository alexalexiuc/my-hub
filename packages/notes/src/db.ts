import pg from 'pg';
import { logger } from '@my-hub/shared/utils';

export type Db = pg.Pool;

/** Bumped when the table layout changes. The index is disposable, so a mismatch rebuilds it from the files. */
export const SCHEMA_VERSION = 3;

export interface DbOptions {
  connectionString: string;
  /** Isolated schema (benchmarks). Extensions stay in `public`. */
  schema?: string;
  max?: number;
}

/** Opens a connection pool. With `schema`, creates it and puts it first on the search path. */
export async function createDb({ connectionString, schema, max = 8 }: DbOptions): Promise<Db> {
  if (schema) {
    if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`Invalid schema name "${schema}"`);
    const admin = new pg.Pool({ connectionString, max: 1 });
    await admin.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await admin.end();
  }
  // Session-level trigram thresholds so `<%` / `%` can use the GIN indexes with typo-tolerant cut-offs.
  const options = [
    '-c pg_trgm.word_similarity_threshold=0.4',
    '-c pg_trgm.similarity_threshold=0.25',
    ...(schema ? [`-c search_path=${schema},public`] : []),
  ].join(' ');
  const pool = new pg.Pool({ connectionString, max, options });
  pool.on('error', err => logger.warn(`[notes] idle pg client error: ${err.message}`));
  return pool;
}

/** Formats a vector for a `$n::vector` parameter. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

/**
 * Creates extensions and tables, or rebuilds them (dropping all index rows) when the embedding model, its
 * dimension or the schema version changed. Returns true when the tables were (re)created empty.
 */
export async function ensureSchema(db: Db, embedding: { model: string; dimensions: number }): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    // Pinned to public: unpinned, they land in the first search_path schema, which an isolated bench schema
    // would then hide from other schemas and drop on cleanup (DROP SCHEMA ... CASCADE).
    await client.query('CREATE EXTENSION IF NOT EXISTS vector SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes_meta (key text PRIMARY KEY, value text NOT NULL)`);

    const meta = new Map<string, string>(
      (await client.query<{ key: string; value: string }>('SELECT key, value FROM notes_meta')).rows.map(r => [
        r.key,
        r.value,
      ]),
    );
    const want = {
      schema_version: String(SCHEMA_VERSION),
      embedding_model: embedding.model,
      embedding_dimensions: String(embedding.dimensions),
    };
    const stale = Object.entries(want).some(([k, v]) => meta.has(k) && meta.get(k) !== v);
    const exists = (await client.query(`SELECT to_regclass('notes') IS NOT NULL AS ok`)).rows[0].ok as boolean;

    if (stale) {
      logger.info(`[notes] index layout or embedding model changed; rebuilding the disposable index`);
      await client.query('DROP TABLE IF EXISTS entries, notes CASCADE');
    }
    const created = stale || !exists;

    const dim = Math.trunc(embedding.dimensions);
    await client.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

      CREATE TABLE IF NOT EXISTS notes (
        id             bigserial PRIMARY KEY,
        user_id        text NOT NULL,
        path           text NOT NULL,
        title          text NOT NULL,
        category       text NOT NULL,
        tags           text[] NOT NULL DEFAULT '{}',
        aliases        text[] NOT NULL DEFAULT '{}',
        names          text NOT NULL,
        name_embedding vector(${dim}),
        reviewed       boolean NOT NULL DEFAULT true,
        fm_updated     date,
        content_hash   text NOT NULL,
        updated_at     timestamptz NOT NULL,
        UNIQUE (user_id, path)
      );

      CREATE TABLE IF NOT EXISTS entries (
        id         bigserial PRIMARY KEY,
        note_id    bigint NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        entry_key  text NOT NULL,
        entry_date date,
        type       text NOT NULL,
        text       text NOT NULL,
        line_hash  text NOT NULL,
        norm       text GENERATED ALWAYS AS (lower(immutable_unaccent(text))) STORED,
        tsv        tsvector GENERATED ALWAYS AS (to_tsvector('simple', immutable_unaccent(text))) STORED,
        embedding  vector(${dim}) NOT NULL,
        UNIQUE (note_id, entry_key)
      );

      CREATE INDEX IF NOT EXISTS entries_tsv_idx ON entries USING gin (tsv);
      CREATE INDEX IF NOT EXISTS entries_norm_trgm ON entries USING gin (norm gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS notes_names_trgm ON notes USING gin (names gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS notes_user_category ON notes (user_id, category);
      -- Optional once entries exceed ~20k (benchmark decides):
      -- CREATE INDEX entries_vec_idx ON entries USING hnsw (embedding vector_cosine_ops);
    `);
    for (const [k, v] of Object.entries(want)) {
      await client.query(
        'INSERT INTO notes_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [k, v],
      );
    }
    return created;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
  }
}
