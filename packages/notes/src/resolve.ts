import type { Db } from './db';
import { normalizeForMatch, slugify } from './slug';

export interface ExactNote {
  path: string;
  title: string;
  category: string;
  /** `path` when the note's file slug equals the subject's slug, `name` when its title or an alias does. */
  matchedBy: 'path' | 'name';
}

/**
 * The note a subject names exactly: same path slug, or same title/alias after case and accent folding.
 * Nothing fuzzy. With several matches the most recently updated one wins.
 */
export async function findExactNote(db: Db, userId: string, subject: string): Promise<ExactNote | null> {
  const res = await db.query<{ path: string; title: string; category: string; by_path: boolean }>(
    `SELECT n.path, n.title, n.category, (n.path LIKE '%/' || $3 || '.md') AS by_path
     FROM notes n
     WHERE n.user_id = $1 AND (n.path LIKE '%/' || $3 || '.md' OR $2 = ANY (string_to_array(n.names, ' | ')))
     ORDER BY COALESCE(n.fm_updated, n.updated_at::date) DESC, n.updated_at DESC, n.path
     LIMIT 1`,
    [userId, normalizeForMatch(subject), slugify(subject)],
  );
  const row = res.rows[0];
  return row
    ? { path: row.path, title: row.title, category: row.category, matchedBy: row.by_path ? 'path' : 'name' }
    : null;
}
