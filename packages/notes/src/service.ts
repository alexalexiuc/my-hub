import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { UserInputError, logger } from '@my-hub/shared/utils';
import { ensureSchema, type Db } from './db';
import { type EmbeddingProvider } from './embeddings';
import { Indexer, type IndexResult } from './indexer';
import {
  ENTRY_TYPES,
  appendEntry,
  createNoteText,
  listEntries,
  parseNote,
  readFrontmatter,
  removeEntry,
  replaceEntry,
  serializeNote,
  setFrontmatterKey,
  setFrontmatterList,
} from './markdown';
import { DEFAULT_RESOLVE_CONFIG, decide, findCandidates, type Candidate, type ResolveConfig } from './resolve';
import { DEFAULT_RRF_K } from './rrf';
import { searchNotes, type SearchOptions, type SearchResult } from './search';
import { slugify } from './slug';
import { NoteStore, assertNotePath } from './store';

export interface NotesRuntimeConfig {
  db: Db;
  embedder: EmbeddingProvider;
  /** Root directory; each user gets `<root>/<userId>/`. */
  root: string;
  gitRemote?: string;
  rrfK?: number;
  resolve?: Partial<ResolveConfig>;
}

export interface RememberInput {
  /** What the note is about, e.g. "Carpet cleaning" or "Engine oil". Resolved to an existing note when similar. */
  subject: string;
  text: string;
  type: string;
  /** Skips subject resolution: append to (or create) exactly this note. */
  path?: string;
  /** Folder for a newly created note (default `misc`). */
  category?: string;
  tags?: string[];
  aliases?: string[];
  /** YYYY-MM-DD; defaults to today. */
  date?: string;
}

export type RememberResult =
  | {
      status: 'saved';
      path: string;
      title: string;
      created: boolean;
      entryId: string;
      matchedScore: number | null;
      timings: { totalMs: number };
    }
  | { status: 'ambiguous'; candidates: Candidate[] };

export interface RecentEntry {
  path: string;
  title: string;
  id: string;
  date: string | null;
  type: string;
  text: string;
}

export interface NoteListItem {
  path: string;
  title: string;
  category: string;
  entryCount: number;
}

const safeUserDir = (userId: string) => userId.replace(/[^A-Za-z0-9_-]/g, '_');
const today = () => new Date().toISOString().slice(0, 10);

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
      if (d.isDirectory() && !d.name.startsWith('.')) await this.forUser(d.name).sync();
    }
  }

  async close(): Promise<void> {
    await this.db.end();
  }
}

/** Opens the schema (rebuilding it if the embedding model changed) and returns a runtime. */
export async function createNotesRuntime(config: NotesRuntimeConfig): Promise<NotesRuntime> {
  const runtime = new NotesRuntime(config);
  runtime.rebuilt = await ensureSchema(config.db, config.embedder);
  return runtime;
}

/** All note operations for one user. Writes are serialised, committed to git and indexed before returning. */
export class NotesService {
  readonly store: NoteStore;
  private readonly indexer: Indexer;
  private synced: Promise<void> | null = null;

  constructor(
    private readonly rt: NotesRuntime,
    readonly userId: string,
  ) {
    this.store = new NoteStore(join(rt.config.root, safeUserDir(userId)), rt.config.gitRemote);
    this.indexer = new Indexer(rt.db, this.store, rt.embedder, userId);
  }

  private get resolveConfig(): ResolveConfig {
    return { ...DEFAULT_RESOLVE_CONFIG, ...this.rt.config.resolve };
  }

  /** Indexes files that changed outside the app (Obsidian, git pull). Runs once; later calls reuse it. */
  sync(opts: { full?: boolean } = {}): Promise<{ files: number; embedded: number; removedNotes: number }> {
    const run = this.store.serialize(() => this.indexer.syncAll(opts));
    this.synced = run.then(() => undefined);
    return run;
  }

  private async ready(): Promise<void> {
    await this.store.init();
    this.synced ??= this.sync().then(() => undefined);
    await this.synced;
  }

  async search(opts: SearchOptions): Promise<SearchResult> {
    await this.ready();
    return searchNotes(this.rt.db, this.rt.embedder, this.userId, { k: this.rt.config.rrfK ?? DEFAULT_RRF_K, ...opts });
  }

  async read(path: string): Promise<{ path: string; content: string }> {
    assertNotePath(path);
    await this.store.init();
    const content = await this.store.read(path);
    if (content === null)
      throw new UserInputError(`No note at "${path}". Use notes_search or notes_list to find the path.`);
    return { path, content };
  }

  async remember(input: RememberInput): Promise<RememberResult> {
    const t0 = performance.now();
    await this.ready();
    const subject = input.subject.trim();
    if (!subject) throw new UserInputError('subject must not be empty');
    if (!input.text.trim()) throw new UserInputError('text must not be empty');
    const date = input.date ?? today();

    return this.store.serialize(async () => {
      let path: string;
      let created = false;
      let matchedScore: number | null = null;

      if (input.path) {
        assertNotePath(input.path);
        path = input.path;
        created = !(await this.store.exists(path));
      } else {
        const res = decide(
          await findCandidates(this.rt.db, this.rt.embedder, this.userId, subject, this.resolveConfig),
          this.resolveConfig,
        );
        if (res.kind === 'ambiguous') return { status: 'ambiguous' as const, candidates: res.candidates };
        if (res.kind === 'match') {
          path = res.candidate.path;
          matchedScore = Math.round(res.candidate.score * 1000) / 1000;
        } else {
          path = await this.freshPath(input.category ?? 'misc', subject);
          created = true;
        }
      }

      const source =
        (await this.store.read(path)) ??
        createNoteText({
          title: subject,
          category: path.slice(0, path.indexOf('/')),
          tags: [],
          aliases: [],
          updated: date,
        });
      const note = parseNote(source);
      const fm = readFrontmatter(note, { title: subject, category: path.slice(0, path.indexOf('/')) });

      const addUnique = (existing: string[], extra: string[] | undefined) => {
        const seen = new Set(existing.map(s => s.toLowerCase()));
        const merged = [...existing];
        for (const s of extra ?? []) {
          const v = s.trim();
          if (v && !seen.has(v.toLowerCase())) {
            seen.add(v.toLowerCase());
            merged.push(v);
          }
        }
        return merged;
      };
      const aliases = addUnique(fm.aliases, input.aliases);
      if (aliases.length !== fm.aliases.length) setFrontmatterList(note, 'aliases', aliases);
      const tags = addUnique(fm.tags, input.tags);
      if (tags.length !== fm.tags.length) setFrontmatterList(note, 'tags', tags);

      const entryId = appendEntry(note, { date, type: input.type, text: input.text });
      setFrontmatterKey(note, 'updated', date);
      await this.store.write(path, serializeNote(note));
      await this.store.commit(`notes(${path.replace(/\.md$/, '')}): +entry ^${entryId}`);
      await this.indexer.indexFile(path);

      return {
        status: 'saved' as const,
        path,
        title: fm.title,
        created,
        entryId,
        matchedScore,
        timings: { totalMs: Math.round((performance.now() - t0) * 100) / 100 },
      };
    });
  }

  async editEntry(path: string, entryId: string, patch: { text?: string; type?: string }): Promise<{ path: string }> {
    return this.mutate(path, `~entry ^${entryId}`, note => {
      if (!replaceEntry(note, entryId, patch)) throw new UserInputError(`No entry ^${entryId} in ${path}.`);
    });
  }

  async deleteEntry(path: string, entryId: string): Promise<{ path: string }> {
    return this.mutate(path, `-entry ^${entryId}`, note => {
      if (!removeEntry(note, entryId)) throw new UserInputError(`No entry ^${entryId} in ${path}.`);
    });
  }

  async addAlias(path: string, alias: string): Promise<{ path: string; aliases: string[] }> {
    const value = alias.trim();
    if (!value) throw new UserInputError('alias must not be empty');
    let aliases: string[] = [];
    await this.mutate(path, `+alias ${value}`, note => {
      const fm = readFrontmatter(note, { title: path, category: '' });
      aliases = fm.aliases.some(a => a.toLowerCase() === value.toLowerCase()) ? fm.aliases : [...fm.aliases, value];
      setFrontmatterList(note, 'aliases', aliases);
    });
    return { path, aliases };
  }

  /** Newest entries across all notes, by entry date. */
  async recent(limit = 10): Promise<RecentEntry[]> {
    await this.ready();
    const res = await this.rt.db.query<{
      path: string;
      title: string;
      entry_key: string;
      entry_date: string | null;
      type: string;
      text: string;
    }>(
      `SELECT n.path, n.title, e.entry_key, e.entry_date::text, e.type, e.text
       FROM entries e JOIN notes n ON n.id = e.note_id
       WHERE n.user_id = $1 AND e.entry_key <> '_body'
       ORDER BY e.entry_date DESC NULLS LAST, e.id DESC LIMIT $2`,
      [this.userId, Math.min(Math.max(limit, 1), 50)],
    );
    return res.rows.map(r => ({
      path: r.path,
      title: r.title,
      id: r.entry_key,
      date: r.entry_date,
      type: r.type,
      text: r.text,
    }));
  }

  async list(category?: string): Promise<NoteListItem[]> {
    await this.ready();
    const res = await this.rt.db.query<{ path: string; title: string; category: string; n: string }>(
      `SELECT n.path, n.title, n.category, count(e.id) FILTER (WHERE e.entry_key <> '_body')::text AS n
       FROM notes n LEFT JOIN entries e ON e.note_id = n.id
       WHERE n.user_id = $1 AND ($2::text IS NULL OR n.category = $2)
       GROUP BY n.id ORDER BY n.category, n.title`,
      [this.userId, category ?? null],
    );
    return res.rows.map(r => ({ path: r.path, title: r.title, category: r.category, entryCount: Number(r.n) }));
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
    await this.store.serialize(async () => {
      await this.rt.db.query('DELETE FROM notes WHERE user_id = $1', [this.userId]);
      await this.store.destroy();
    });
    this.synced = null;
  }

  /** Pushes the notes repo to its backup remote. Never throws. */
  push() {
    return this.store.push();
  }

  /** Entries of a note, for tests and tooling. */
  async entries(path: string) {
    const { content } = await this.read(path);
    return listEntries(parseNote(content));
  }

  private async mutate(path: string, what: string, fn: (note: ReturnType<typeof parseNote>) => void) {
    assertNotePath(path);
    await this.ready();
    return this.store.serialize(async () => {
      const source = await this.store.read(path);
      if (source === null) throw new UserInputError(`No note at "${path}".`);
      const note = parseNote(source);
      fn(note);
      setFrontmatterKey(note, 'updated', today());
      await this.store.write(path, serializeNote(note));
      await this.store.commit(`notes(${path.replace(/\.md$/, '')}): ${what}`);
      await this.indexer.indexFile(path);
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
export type { Candidate };

/** Logs a warning-level line; kept here so callers do not import the logger just for this. */
export function warnNotes(message: string): void {
  logger.warn(`[notes] ${message}`);
}
