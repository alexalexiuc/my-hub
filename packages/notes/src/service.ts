import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { UserInputError, dedupeTrimmed, isIsoDateStr, logger, omitUndefined } from '@my-hub/shared/utils';
import { ensureSchema, type Db } from './db';
import { type EmbeddingProvider } from './embeddings';
import { fetchCategories, fetchHeaders, type CategoryCount, type HeaderFilter, type NoteHeader } from './headers';
import { Indexer, type IndexResult } from './indexer';
import {
  ENTRY_TYPES,
  appendEntry,
  bodyText,
  createNoteText,
  listEntries,
  oneLine,
  parseNote,
  readFrontmatter,
  removeEntry,
  replaceEntry,
  serializeNote,
  setFrontmatterKey,
  setFrontmatterList,
} from './markdown';
import { findExactNote } from './resolve';
import { searchNotes, type SearchHit, type SearchOptions, type SearchResult } from './search';
import { slugify } from './slug';
import { NoteStore, assertNotePath, categoryOf, defaultTitle, userDirName } from './store';

export interface NotesRuntimeConfig {
  db: Db;
  embedder: EmbeddingProvider;
  /** Root directory; each user gets `<root>/<userId>/`. */
  root: string;
}

export interface RememberInput {
  /** What the note is about (a product, service or topic). Appended to the note with exactly this title or alias, else a new note. */
  subject: string;
  text: string;
  type: string;
  /** Skips subject matching: append to (or create) exactly this note. */
  path?: string;
  /** Folder for a newly created note (default `misc`). */
  category?: string;
  tags?: string[];
  aliases?: string[];
  /** YYYY-MM-DD; defaults to today. */
  date?: string;
}

export interface WriteOptions {
  /** The user's local date (YYYY-MM-DD), stamped as `updated`. Defaults to the UTC date. */
  today?: string;
}

export interface RememberResult {
  status: 'saved';
  path: string;
  title: string;
  created: boolean;
  /** How an existing note was found: its file slug, its title/alias, or the explicit `path`. Null when created. */
  matchedBy: 'path' | 'name' | null;
  entryId: string;
  /** Set only when this call created the first note of a category. */
  newCategory?: true;
  /** Set with `newCategory`: the categories that existed before this write (the new one is not in it). */
  existingCategories?: string[];
  timings: { totalMs: number };
}

export interface RecentEntry {
  path: string;
  title: string;
  id: string;
  date: string | null;
  type: string;
  text: string;
}

export interface BrowseOptions extends Pick<HeaderFilter, 'category' | 'tag' | 'updatedSince' | 'unreviewedOnly'> {
  /** 1-5 phrasings; when given, notes are ranked by hybrid search instead of ordered by category and title. */
  queries?: string[];
  /** Default 50, max 200. */
  limit?: number;
}

export interface ReviewQueue {
  items: { note: NoteHeader; similar: NoteHeader[] }[];
  /** Unreviewed notes beyond this page. */
  remaining: number;
}

export interface MergeResult {
  into: string;
  from: string;
  movedEntries: number;
  /** The aliases `into` has after the merge. */
  aliases: string[];
}

const utcToday = () => new Date().toISOString().slice(0, 10);
/** The later of two YYYY-MM-DD dates, so `updated` never moves backwards. */
const laterDate = (a: string | null, b: string): string => (a && isIsoDateStr(a) && a > b ? a : b);

/** `existing` plus the `extra` values not already in it (case-insensitive, whitespace collapsed to one line). */
const mergeUnique = (existing: string[], extra: string[]): string[] => [
  ...existing,
  ...dedupeTrimmed(extra.map(oneLine), new Set(existing.map(v => v.toLowerCase()))),
];

/** Shared state for all users: database, embedder, config. Create once with `createNotesRuntime`. */
export class NotesRuntime {
  private services = new Map<string, NotesService>();
  /** True when the index tables were just (re)created and every file must be indexed. */
  rebuilt = false;

  constructor(readonly config: NotesRuntimeConfig) {}

  get embedder(): EmbeddingProvider {
    return this.config.embedder;
  }

  get db(): Db {
    return this.config.db;
  }

  forUser(userId: string): NotesService {
    let s = this.services.get(userId);
    if (!s) this.services.set(userId, (s = new NotesService(this, userId)));
    return s;
  }

  /** Loads the model and indexes every user directory that changed on disk since the last run. */
  async start(): Promise<void> {
    await this.embedder.ready();
    const dirs = await readdir(this.config.root, { withFileTypes: true }).catch(() => []);
    for (const d of dirs) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      // One user's broken directory must not keep the others (or the server) from starting.
      try {
        await this.forUser(d.name).sync();
      } catch (err) {
        logger.warn(
          `[notes] initial sync of user ${d.name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}

async function deleteUserData(db: Db, store: NoteStore, userId: string): Promise<void> {
  // 42P01: the index tables were never created, so there are no rows to delete.
  await db.query('DELETE FROM notes WHERE user_id = $1', [userId]).catch((err: { code?: string }) => {
    if (err.code !== '42P01') throw err;
  });
  await store.destroy();
}

/**
 * Deletes a user's notes (index rows and files) with only a database pool, without loading the embedding model or
 * syncing anyone. Use `NotesService.deleteAll` instead when the runtime is up, so the user's writes stay serialised.
 */
export function deleteAllUserNotes(opts: { db: Db; root: string; userId: string }): Promise<void> {
  return deleteUserData(opts.db, new NoteStore(join(opts.root, userDirName(opts.userId))), opts.userId);
}

/** Opens the schema (rebuilding it if the embedding model changed) and returns a runtime. */
export async function createNotesRuntime(config: NotesRuntimeConfig): Promise<NotesRuntime> {
  const runtime = new NotesRuntime(config);
  runtime.rebuilt = await ensureSchema(config.db, config.embedder);
  return runtime;
}

/** All note operations for one user. Writes are serialised, indexed before returning. */
export class NotesService {
  readonly store: NoteStore;
  private readonly indexer: Indexer;
  private synced: Promise<void> | null = null;

  constructor(
    private readonly rt: NotesRuntime,
    readonly userId: string,
  ) {
    this.store = new NoteStore(join(rt.config.root, userDirName(userId)));
    this.indexer = new Indexer(rt.db, this.store, rt.embedder, userId);
  }

  /** Indexes files that changed outside the app (Obsidian, a restored backup). Runs once; later calls reuse it. */
  sync(opts: { full?: boolean } = {}): Promise<{ files: number; embedded: number; removedNotes: number }> {
    const run = this.store.serialize(() => this.indexer.syncAll(opts));
    this.track(run);
    return run;
  }

  /**
   * Remembers `run` as the current sync. The stored copy has its own handler (it clears itself on failure so the
   * next call retries) and so can never be an unhandled rejection; callers that await it still see the error.
   */
  private track(run: Promise<unknown>): Promise<void> {
    const p = run.then(() => undefined);
    p.catch(() => {
      if (this.synced === p) this.synced = null;
    });
    this.synced = p;
    return p;
  }

  private async ready(): Promise<void> {
    await this.store.init();
    if (this.synced) await this.synced;
    else await this.sync();
  }

  /** Inside the write queue: re-syncs from the files when an earlier write could not index (a stale index). */
  private async ensureFresh(): Promise<void> {
    if (this.synced === null) await this.track(this.indexer.syncAll());
  }

  /**
   * Indexes files after they are written. The files are already the source of truth, so an index failure (embedder
   * timeout, database hiccup) must not fail the write: the caller would retry and save the fact twice. It is
   * logged, and the next call re-syncs this user from the files.
   */
  private async indexAfterWrite(...paths: string[]): Promise<void> {
    try {
      for (const path of paths) await this.indexer.indexFile(path);
    } catch (err) {
      logger.warn(
        `[notes] indexing ${paths.join(', ')} failed; will re-sync on next use: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.synced = null;
    }
  }

  async search(opts: SearchOptions): Promise<SearchResult> {
    await this.ready();
    return searchNotes(this.rt.db, this.rt.embedder, this.userId, opts);
  }

  async read(path: string): Promise<{ path: string; content: string }> {
    assertNotePath(path);
    await this.store.init();
    const content = await this.store.read(path);
    if (content === null)
      throw new UserInputError(`No note at "${path}". Use notes_search or notes_browse to find the path.`);
    return { path, content };
  }

  /**
   * Appends an entry to the note whose title or an alias equals `subject` exactly, or creates a new (unreviewed)
   * note. Never guesses: near-duplicates are left for the review pass (`reviewQueue` + `merge`).
   */
  async remember(input: RememberInput): Promise<RememberResult> {
    const t0 = performance.now();
    await this.ready();
    const subject = oneLine(input.subject);
    if (!subject) throw new UserInputError('subject must not be empty');
    if (!input.text.trim()) throw new UserInputError('text must not be empty');
    const date = input.date ?? utcToday();
    if (!isIsoDateStr(date)) throw new UserInputError(`date must be a real calendar date (YYYY-MM-DD), got "${date}".`);

    return this.store.serialize(async () => {
      await this.ensureFresh();
      let path: string;
      let created = false;
      let matchedBy: RememberResult['matchedBy'] = null;
      let before: CategoryCount[] | null = null;

      if (input.path) {
        assertNotePath(input.path);
        path = input.path;
        created = !(await this.store.exists(path));
        if (!created) matchedBy = 'path';
      } else {
        const exact = await findExactNote(this.rt.db, this.userId, subject);
        if (exact) {
          path = exact.path;
          matchedBy = exact.matchedBy;
        } else {
          path = await this.freshPath(input.category ?? 'misc', subject);
          created = true;
        }
      }

      if (created) before = await fetchCategories(this.rt.db, this.userId);

      const source =
        (await this.store.read(path)) ??
        createNoteText({
          title: subject,
          category: categoryOf(path),
          tags: [],
          aliases: [],
          updated: date,
          reviewed: false,
        });
      const note = parseNote(source);
      const fm = readFrontmatter(note, { title: subject, category: categoryOf(path) });

      const aliases = mergeUnique(fm.aliases, input.aliases ?? []);
      if (aliases.length !== fm.aliases.length) setFrontmatterList(note, 'aliases', aliases);
      const tags = mergeUnique(fm.tags, input.tags ?? []);
      if (tags.length !== fm.tags.length) setFrontmatterList(note, 'tags', tags);

      const entryId = appendEntry(note, { date, type: input.type, text: input.text });
      // A back-dated entry must not make the note look stale.
      setFrontmatterKey(note, 'updated', laterDate(fm.updated, date));
      await this.store.write(path, serializeNote(note));
      await this.indexAfterWrite(path);

      const isNewCategory = before !== null && !before.some(c => c.name === categoryOf(path));
      const result: RememberResult = {
        status: 'saved',
        path,
        title: fm.title,
        created,
        matchedBy,
        entryId,
        timings: { totalMs: Math.round((performance.now() - t0) * 100) / 100 },
      };
      return Object.assign(
        result,
        omitUndefined({
          newCategory: isNewCategory ? (true as const) : undefined,
          existingCategories: isNewCategory ? before?.map(c => c.name) : undefined,
        }),
      );
    });
  }

  async editEntry(
    path: string,
    entryId: string,
    patch: { text?: string; type?: string },
    opts: WriteOptions = {},
  ): Promise<{ path: string }> {
    if (patch.text === undefined && patch.type === undefined) throw new UserInputError('Pass text and/or type.');
    return this.mutate(path, `~entry ^${entryId}`, opts, note => {
      if (!replaceEntry(note, entryId, patch)) throw new UserInputError(`No entry ^${entryId} in ${path}.`);
    });
  }

  /** Deletes one entry. A note left with no entries and no free text is deleted too (`noteDeleted`). */
  async deleteEntry(
    path: string,
    entryId: string,
    opts: WriteOptions = {},
  ): Promise<{ path: string; noteDeleted: boolean }> {
    let noteDeleted = false;
    await this.mutate(path, `-entry ^${entryId}`, opts, note => {
      if (!removeEntry(note, entryId)) throw new UserInputError(`No entry ^${entryId} in ${path}.`);
      noteDeleted = listEntries(note).length === 0 && bodyText(note) === '';
      return noteDeleted ? 'remove' : 'write';
    });
    return { path, noteDeleted };
  }

  async addAlias(path: string, alias: string, opts: WriteOptions = {}): Promise<{ path: string; aliases: string[] }> {
    const value = oneLine(alias);
    if (!value) throw new UserInputError('alias must not be empty');
    let aliases: string[] = [];
    await this.mutate(path, `+alias ${value}`, opts, note => {
      const fm = readFrontmatter(note, { title: defaultTitle(path), category: '' });
      aliases = mergeUnique(fm.aliases, [value]);
      setFrontmatterList(note, 'aliases', aliases);
    });
    return { path, aliases };
  }

  /** Newest entries across all notes, by entry date. */
  async recent(limit = 10): Promise<RecentEntry[]> {
    await this.ready();
    const res = await this.rt.db.query<RecentEntry>(
      `SELECT n.path, n.title, e.entry_key AS id, e.entry_date::text AS date, e.type, e.text
       FROM entries e JOIN notes n ON n.id = e.note_id
       WHERE n.user_id = $1 AND e.entry_key <> '_body'
       ORDER BY e.entry_date DESC NULLS LAST, e.id DESC LIMIT $2`,
      [this.userId, Math.min(Math.max(limit, 1), 50)],
    );
    return res.rows;
  }

  /** All of the user's categories with their note counts, most used first, then by name. */
  async categories(): Promise<CategoryCount[]> {
    await this.ready();
    return fetchCategories(this.rt.db, this.userId);
  }

  /** Note headers, filtered, and ranked by hybrid search when `queries` are given. */
  async browse(opts: BrowseOptions = {}): Promise<NoteHeader[]> {
    await this.ready();
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const filter: HeaderFilter = omitUndefined({
      category: opts.category,
      tag: opts.tag,
      updatedSince: opts.updatedSince,
      unreviewedOnly: opts.unreviewedOnly,
    });
    if (!opts.queries?.length) return fetchHeaders(this.rt.db, this.userId, filter, { limit });

    // The search takes the category; the other filters are applied to its (widened) result list.
    const postFilters = filter.tag !== undefined || filter.updatedSince !== undefined || filter.unreviewedOnly;
    const { hits } = await searchNotes(this.rt.db, this.rt.embedder, this.userId, {
      queries: opts.queries,
      category: opts.category,
      limit: postFilters ? 200 : limit,
    });
    return (await this.rankedHeaders(hits, filter)).slice(0, limit);
  }

  /** Unreviewed notes (oldest first), each with the existing notes most similar to it. */
  async reviewQueue({
    limit = 10,
    suggestions = 5,
  }: { limit?: number; suggestions?: number } = {}): Promise<ReviewQueue> {
    await this.ready();
    const pageSize = Math.min(Math.max(limit, 1), 50);
    const unreviewed = await fetchHeaders(
      this.rt.db,
      this.userId,
      { unreviewedOnly: true },
      { limit: 100000, oldestFirst: true },
    );
    const items: ReviewQueue['items'] = [];
    for (const note of unreviewed.slice(0, pageSize)) {
      const { hits } = await searchNotes(this.rt.db, this.rt.embedder, this.userId, {
        queries: [note.title, ...note.aliases.slice(0, 4)],
        limit: suggestions + 1,
      });
      const similar = (
        await this.rankedHeaders(
          hits.filter(h => h.path !== note.path),
          {},
        )
      ).slice(0, suggestions);
      items.push({ note, similar });
    }
    return { items, remaining: unreviewed.length - items.length };
  }

  /**
   * Folds note `from` into `into` in one write: entries (with their dates and types), aliases (including `from`'s
   * title), tags and free body text move over, then `from` is deleted.
   */
  async merge(from: string, into: string): Promise<MergeResult> {
    assertNotePath(from);
    assertNotePath(into);
    if (from === into) throw new UserInputError('Cannot merge a note into itself.');
    await this.ready();
    return this.store.serialize(async () => {
      const [fromSource, intoSource] = await Promise.all([this.store.read(from), this.store.read(into)]);
      if (fromSource === null) throw new UserInputError(`No note at "${from}".`);
      if (intoSource === null) throw new UserInputError(`No note at "${into}".`);
      const src = parseNote(fromSource);
      const dst = parseNote(intoSource);
      const srcFm = readFrontmatter(src, { title: defaultTitle(from), category: categoryOf(from) });
      const dstFm = readFrontmatter(dst, { title: defaultTitle(into), category: categoryOf(into) });

      const moved = listEntries(src);
      for (const e of moved) appendEntry(dst, { date: e.date, type: e.type, text: e.text });

      const dstTitle = dstFm.title.trim().toLowerCase();
      const aliases = mergeUnique(
        dstFm.aliases,
        [srcFm.title, ...srcFm.aliases].filter(a => a.trim().toLowerCase() !== dstTitle),
      );
      if (aliases.length !== dstFm.aliases.length) setFrontmatterList(dst, 'aliases', aliases);
      const tags = mergeUnique(dstFm.tags, srcFm.tags);
      if (tags.length !== dstFm.tags.length) setFrontmatterList(dst, 'tags', tags);

      const freeText = src.body.filter(l => l.kind === 'text').map(l => l.raw);
      while (freeText.length && freeText[0]!.trim() === '') freeText.shift();
      while (freeText.length && freeText.at(-1)!.trim() === '') freeText.pop();
      if (freeText.length) {
        dst.body.push(...['', ...freeText].map(raw => ({ kind: 'text' as const, raw })));
        dst.trailingNewline = true;
      }

      const updated = [srcFm.updated, dstFm.updated]
        .filter((d): d is string => !!d)
        .sort()
        .at(-1);
      if (updated) setFrontmatterKey(dst, 'updated', updated);

      await this.store.write(into, serializeNote(dst));
      await this.store.remove(from);
      await this.indexAfterWrite(from, into);
      return { into, from, movedEntries: moved.length, aliases };
    });
  }

  /** Marks notes as checked by a review pass (`reviewed: true`). */
  async markReviewed(paths: string[]): Promise<{ reviewed: string[] }> {
    const unique = [...new Set(paths)];
    if (unique.length < 1 || unique.length > 50) throw new UserInputError('Pass 1-50 note paths.');
    unique.forEach(assertNotePath);
    await this.ready();
    return this.store.serialize(async () => {
      const notes = new Map<string, ReturnType<typeof parseNote>>();
      for (const path of unique) {
        const source = await this.store.read(path);
        if (source === null) throw new UserInputError(`No note at "${path}".`);
        notes.set(path, parseNote(source));
      }
      for (const [path, note] of notes) {
        if (readFrontmatter(note, { title: defaultTitle(path), category: '' }).reviewed) continue;
        setFrontmatterKey(note, 'reviewed', 'true');
        await this.store.write(path, serializeNote(note));
      }
      await this.indexAfterWrite(...unique);
      return { reviewed: unique };
    });
  }

  /** Rebuilds this user's index from the files (re-embedding everything when `full`). */
  async reindex(opts: { full?: boolean } = { full: true }) {
    await this.store.init();
    const t0 = performance.now();
    const res = await this.sync(opts);
    return { ...res, ms: Math.round(performance.now() - t0) };
  }

  /** Re-reads one file into the index (used after external edits). */
  indexPath(path: string): Promise<IndexResult> {
    return this.store.serialize(() => this.indexer.indexFile(path));
  }

  /** Removes all of the user's notes and index rows. */
  async deleteAll(): Promise<void> {
    await this.store.serialize(() => deleteUserData(this.rt.db, this.store, this.userId));
    this.synced = null;
  }

  /** Entries of a note, for tests and tooling. */
  async entries(path: string) {
    const { content } = await this.read(path);
    return listEntries(parseNote(content));
  }

  /** Headers for search hits, in rank order, with score and matchedBy; the filter drops the rest. */
  private async rankedHeaders(hits: SearchHit[], filter: HeaderFilter): Promise<NoteHeader[]> {
    if (hits.length === 0) return [];
    const headers = await fetchHeaders(this.rt.db, this.userId, { ...filter, paths: hits.map(h => h.path) });
    const byPath = new Map(headers.map(h => [h.path, h]));
    return hits.flatMap(h => {
      const header = byPath.get(h.path);
      return header ? [{ ...header, score: h.score, matchedBy: h.matchedBy }] : [];
    });
  }

  private async mutate(
    path: string,
    what: string,
    opts: WriteOptions,
    /** Edits the note in place; returning `'remove'` deletes the file instead of writing it. */
    fn: (note: ReturnType<typeof parseNote>) => 'write' | 'remove' | void,
  ) {
    assertNotePath(path);
    await this.ready();
    return this.store.serialize(async () => {
      const source = await this.store.read(path);
      if (source === null) throw new UserInputError(`No note at "${path}".`);
      const note = parseNote(source);
      if (fn(note) === 'remove') {
        await this.store.remove(path);
      } else {
        const { updated } = readFrontmatter(note, { title: defaultTitle(path), category: categoryOf(path) });
        setFrontmatterKey(note, 'updated', laterDate(updated, opts.today ?? utcToday()));
        await this.store.write(path, serializeNote(note));
      }
      await this.indexAfterWrite(path);
      return { path };
    });
  }

  /** `<category>/<slug>.md`, suffixed `-2`, `-3`... if that file already exists. */
  private async freshPath(category: string, subject: string): Promise<string> {
    const cat = slugify(category);
    const slug = slugify(subject);
    for (let n = 1; ; n++) {
      const path = `${cat}/${slug}${n > 1 ? `-${n}` : ''}.md`;
      if (!(await this.store.exists(path))) return path;
    }
  }
}

export { ENTRY_TYPES };
