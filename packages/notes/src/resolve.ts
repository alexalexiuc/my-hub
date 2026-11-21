import type { Db } from './db';
import { normalizeForMatch } from './slug';

export interface ExactNote {
  path: string;
  title: string;
  category: string;
  /** Always `name`: the note's title or an alias equals the subject. */
  matchedBy: 'name';
}

/**
 * The note a subject names exactly: same title or alias after case and accent folding. Nothing fuzzy, and no
 * file-slug match (slugs drop characters, so "C++" and "C#" would collide). With several matches the most
 * recently updated one wins.
 */
export async function findExactNote(db: Db, userId: string, subject: string): Promise<ExactNote | null> {
  const res = await db.query<{ path: string; title: string; category: string }>(
    `SELECT n.path, n.title, n.category
     FROM notes n
     WHERE n.user_id = $1 AND $2 = ANY (string_to_array(n.names, ' | '))
     ORDER BY COALESCE(n.fm_updated, n.updated_at::date) DESC, n.updated_at DESC, n.path
     LIMIT 1`,
    [userId, normalizeForMatch(subject)],
  );
  const row = res.rows[0];
  return row ? { path: row.path, title: row.title, category: row.category, matchedBy: 'name' } : null;
}
