import type pg from 'pg';
import { isIsoDateStr, logger } from '@my-hub/shared/utils';
import { bodyText, listEntries, parseNote, readFrontmatter, type Frontmatter } from './markdown';
import { toVectorLiteral, type Db } from './db';
import type { EmbeddingProvider } from './embeddings';
import { normalizeForMatch } from './slug';
import { categoryOf, defaultTitle, sha1, type NoteStore } from './store';

const BODY_KEY = '_body';

export interface IndexResult {
  path: string;
  /** Entries newly embedded (changed or new). */
  embedded: number;
  removedEntries: number;
  skipped: boolean;
}

/** `title` + aliases, accent-stripped, as stored in `notes.names` for trigram matching. */
function namesText(title: string, aliases: string[]): string {
  return normalizeForMatch([title, ...aliases].join(' | '));
}

/** Text embedded for the note-level (name) vector. */
function nameEmbeddingText(title: string, aliases: string[]): string {
  return [title, ...aliases].join('. ');
}

/**
 * Brings the search index in line with the files: upserts one note and only re-embeds entry lines whose
 * `line_hash` changed. Callers hold the store's write queue; this function itself does no locking.
 */
export class Indexer {
  constructor(
    private readonly db: Db,
    private readonly store: NoteStore,
    private readonly embedder: EmbeddingProvider,
    private readonly userId: string,
  ) {}

  /** Indexes one file, or removes its rows when the file is gone. */
  async indexFile(path: string, opts: { force?: boolean } = {}): Promise<IndexResult> {
    const source = await this.store.read(path);
    if (source === null) {
      const res = await this.db.query('DELETE FROM notes WHERE user_id = $1 AND path = $2', [this.userId, path]);
      return { path, embedded: 0, removedEntries: res.rowCount ?? 0, skipped: false };
    }

    const hash = sha1(source);
    const existing = await this.db.query<{ id: string; content_hash: string }>(
      'SELECT id, content_hash FROM notes WHERE user_id = $1 AND path = $2',
      [this.userId, path],
    );
    if (!opts.force && existing.rows[0]?.content_hash === hash) {
      return { path, embedded: 0, removedEntries: 0, skipped: true };
    }

    const note = parseNote(source);
    const category = categoryOf(path);
    const fm = readFrontmatter(note, { title: defaultTitle(path), category });
    const entries = listEntries(note);
    const body = bodyText(note);

    // Rows to index: every entry line plus the free-text body as a pseudo-entry.
    const rows = entries.map(e => ({
      key: e.key,
      date: e.date,
      type: e.type,
      text: e.text,
      hash: sha1(e.raw),
    }));
    if (body) rows.push({ key: BODY_KEY, date: '', type: 'note', text: body, hash: sha1(body) });

    const noteId = existing.rows[0]?.id;
    const current = new Map(
      noteId
        ? (
            await this.db.query<{ entry_key: string; line_hash: string }>(
              'SELECT entry_key, line_hash FROM entries WHERE note_id = $1',
              [noteId],
            )
          ).rows.map(r => [r.entry_key, r.line_hash])
        : [],
    );
    const changed = rows.filter(r => opts.force || current.get(r.key) !== r.hash);
    const keep = new Set(rows.map(r => r.key));
    const gone = [...current.keys()].filter(k => !keep.has(k));

    // Embed before writing anything: a slow or failing embedder must not leave the note half-indexed.
    const [nameVector, ...vectors] = await this.embedder.embedPassages([
      nameEmbeddingText(fm.title, fm.aliases),
      ...changed.map(r => r.text),
    ]);

    // One transaction, so `content_hash` is never saved without the entries it describes. A failure rolls back
    // and the next sync sees a hash mismatch and retries.
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const id = await this.upsertNote(client, path, fm, hash, nameVector!);
      if (gone.length) await client.query('DELETE FROM entries WHERE note_id = $1 AND entry_key = ANY($2)', [id, gone]);
      for (let i = 0; i < changed.length; i++) {
        const r = changed[i]!;
        await client.query(
          `INSERT INTO entries (note_id, entry_key, entry_date, type, text, line_hash, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
           ON CONFLICT (note_id, entry_key) DO UPDATE
             SET entry_date = EXCLUDED.entry_date, type = EXCLUDED.type, text = EXCLUDED.text,
                 line_hash = EXCLUDED.line_hash, embedding = EXCLUDED.embedding`,
          [id, r.key, r.date || null, r.type, r.text, r.hash, toVectorLiteral(vectors[i]!)],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return { path, embedded: changed.length, removedEntries: gone.length, skipped: false };
  }

  private async upsertNote(
    client: pg.PoolClient,
    path: string,
    fm: Frontmatter,
    hash: string,
    nameVector: number[],
  ): Promise<string> {
    const res = await client.query<{ id: string }>(
      `INSERT INTO notes (user_id, path, title, category, tags, aliases, names, name_embedding, reviewed, fm_updated, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, $10, $11, now())
       ON CONFLICT (user_id, path) DO UPDATE
         SET title = EXCLUDED.title, category = EXCLUDED.category, tags = EXCLUDED.tags,
             aliases = EXCLUDED.aliases, names = EXCLUDED.names, name_embedding = EXCLUDED.name_embedding, reviewed = EXCLUDED.reviewed, fm_updated = EXCLUDED.fm_updated,
             content_hash = EXCLUDED.content_hash, updated_at = now()
       RETURNING id`,
      [
        this.userId,
        path,
        fm.title,
        fm.category,
        fm.tags,
        fm.aliases,
        namesText(fm.title, fm.aliases),
        toVectorLiteral(nameVector),
        fm.reviewed,
        fm.updated && isIsoDateStr(fm.updated) ? fm.updated : null,
        hash,
      ],
    );
    return res.rows[0]!.id;
  }

  /**
   * Walks the notes directory: indexes new or changed files and drops rows for deleted files.
   * `full` wipes this user's rows first and re-embeds everything.
   */
  async syncAll(opts: { full?: boolean } = {}): Promise<{ files: number; embedded: number; removedNotes: number }> {
    await this.store.init();
    if (opts.full) await this.db.query('DELETE FROM notes WHERE user_id = $1', [this.userId]);
    const paths = await this.store.listPaths();
    let embedded = 0;
    for (const p of paths) {
      // One unreadable or un-embeddable file must not stop the rest; it is retried on the next sync.
      try {
        embedded += (await this.indexFile(p)).embedded;
      } catch (err) {
        logger.warn(`[notes] skipping ${this.userId}/${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const indexed = await this.db.query<{ path: string }>('SELECT path FROM notes WHERE user_id = $1', [this.userId]);
    const onDisk = new Set(paths);
    const stale = indexed.rows.map(r => r.path).filter(p => !onDisk.has(p));
    if (stale.length)
      await this.db.query('DELETE FROM notes WHERE user_id = $1 AND path = ANY($2)', [this.userId, stale]);
    return { files: paths.length, embedded, removedNotes: stale.length };
  }
}
