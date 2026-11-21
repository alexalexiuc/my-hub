import type { Db } from './db';

/** One note without its entries: enough to decide which notes to read. */
export interface NoteHeader {
  path: string;
  title: string;
  category: string;
  aliases: string[];
  tags: string[];
  entryCount: number;
  /** The `updated` frontmatter date, or null. */
  updated: string | null;
  /** Text of the first entry, else the first non-empty body line, else null. */
  firstLine: string | null;
  reviewed: boolean;
  /** Rank score, set only on ranked results (search-based browse, review suggestions). */
  score?: number;
  matchedBy?: string[];
}

export interface HeaderFilter {
  category?: string;
  tag?: string;
  /** YYYY-MM-DD: only notes updated on or after this day. */
  updatedSince?: string;
  unreviewedOnly?: boolean;
  /** Restrict to these note paths. */
  paths?: string[];
}

/** SQL for a note's last-update day: the frontmatter date, else the day it was indexed. */
export const UPDATED_DAY_SQL = 'COALESCE(n.fm_updated, n.updated_at::date)';

interface Row {
  path: string;
  title: string;
  category: string;
  aliases: string[];
  tags: string[];
  n: string;
  updated: string | null;
  first_line: string | null;
  reviewed: boolean;
}

/** Fetches note headers matching the filter, ordered by category then title (or oldest-update first). */
export async function fetchHeaders(
  db: Db,
  userId: string,
  filter: HeaderFilter,
  opts: { limit?: number; oldestFirst?: boolean } = {},
): Promise<NoteHeader[]> {
  const res = await db.query<Row>(
    `SELECT n.path, n.title, n.category, n.aliases, n.tags, n.reviewed, n.fm_updated::text AS updated,
            (SELECT count(*) FROM entries e WHERE e.note_id = n.id AND e.entry_key <> '_body')::text AS n,
            COALESCE(
              (SELECT e.text FROM entries e WHERE e.note_id = n.id AND e.entry_key <> '_body' ORDER BY e.id LIMIT 1),
              (SELECT NULLIF(split_part(e.text, E'\\n', 1), '') FROM entries e WHERE e.note_id = n.id AND e.entry_key = '_body')
            ) AS first_line
     FROM notes n
     WHERE n.user_id = $1
       AND ($2::text IS NULL OR n.category = $2)
       AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM unnest(n.tags) t WHERE lower(t) = lower($3)))
       AND ($4::date IS NULL OR ${UPDATED_DAY_SQL} >= $4::date)
       AND (NOT $5::boolean OR NOT n.reviewed)
       AND ($6::text[] IS NULL OR n.path = ANY($6))
     ORDER BY ${opts.oldestFirst ? `${UPDATED_DAY_SQL}, n.updated_at, n.path` : 'n.category, n.title, n.path'}
     LIMIT $7`,
    [
      userId,
      filter.category ?? null,
      filter.tag ?? null,
      filter.updatedSince ?? null,
      filter.unreviewedOnly ?? false,
      filter.paths ?? null,
      opts.limit ?? 200,
    ],
  );
  return res.rows.map(r => ({
    path: r.path,
    title: r.title,
    category: r.category,
    aliases: r.aliases,
    tags: r.tags,
    entryCount: Number(r.n),
    updated: r.updated,
    firstLine: r.first_line,
    reviewed: r.reviewed,
  }));
}
