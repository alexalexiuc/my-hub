import { performance } from 'node:perf_hooks';
import { toVectorLiteral, type Db } from './db';
import type { EmbeddingProvider } from './embeddings';
import { DEFAULT_RRF_K, reciprocalRankFusion, type Ranking } from './rrf';
import { normalizeForMatch } from './slug';

export const SEARCH_LEGS = ['fts', 'trgm', 'vec', 'namesTrgm', 'namesVec'] as const;
export type SearchLeg = (typeof SEARCH_LEGS)[number];

export interface SearchOptions {
  /** 1–5 phrasings of the same question (synonyms, RO/RU/EN translations). */
  queries: string[];
  category?: string;
  /** Notes to return (default 5, max 200; the notes_search tool caps it at 20). */
  limit?: number;
  /** RRF constant. */
  k?: number;
  /** Legs to run; all by default. Used by the benchmark to compare configurations. */
  legs?: Partial<Record<SearchLeg, boolean>>;
}

export interface SearchEntry {
  id: string;
  date: string | null;
  type: string;
  text: string;
}

export interface SearchHit {
  path: string;
  title: string;
  category: string;
  score: number;
  /** Which legs matched (fts, trgm, vec, namesTrgm, namesVec), for tuning. */
  matchedBy: string[];
  /** Best matching entry lines (up to 3). */
  entries: SearchEntry[];
}

export interface SearchResult {
  hits: SearchHit[];
  timings: { embedMs: number; dbMs: number; totalMs: number };
}

interface EntryRow {
  id: string;
  note_id: string;
  path: string;
  title: string;
  category: string;
  entry_key: string;
  entry_date: string | null;
  type: string;
  text: string;
}
interface NoteRow {
  note_id: string;
  path: string;
  title: string;
  category: string;
}

const ENTRY_LIMIT = 50;
const NAME_LIMIT = 20;
const ENTRY_COLS = `e.id::text, n.id::text AS note_id, n.path, n.title, n.category, e.entry_key,
  e.entry_date::text, e.type, e.text`;
const NOTE_COLS = `n.id::text AS note_id, n.path, n.title, n.category`;
const CATEGORY_FILTER = `AND ($2::text IS NULL OR n.category = $2)`;

/** Builds an OR-ed prefix tsquery (`rugs | wash:*`) from free text; empty when no usable word remains. */
export function buildTsQuery(q: string): string {
  const words = normalizeForMatch(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 3);
  return [...new Set(words)].map(w => (w.length >= 4 ? `${w}:*` : w)).join(' | ');
}

/**
 * Hybrid search: full-text, trigram (entries and note names) and vector (entries and note names) legs for every
 * query phrasing, fused with Reciprocal Rank Fusion. Entry scores are summed over each note's best three entries,
 * then added to the note-level name score.
 */
export async function searchNotes(
  db: Db,
  embedder: EmbeddingProvider,
  userId: string,
  opts: SearchOptions,
): Promise<SearchResult> {
  const t0 = performance.now();
  const queries = [...new Set(opts.queries.map(q => q.trim()).filter(Boolean))].slice(0, 5);
  if (queries.length === 0) return { hits: [], timings: { embedMs: 0, dbMs: 0, totalMs: 0 } };
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 200);
  const on = (leg: SearchLeg) => opts.legs?.[leg] !== false;
  const category = opts.category ?? null;

  const needVectors = on('vec') || on('namesVec');
  const tEmbed = performance.now();
  const vectors = needVectors ? await embedder.embedQueries(queries) : [];
  const embedMs = performance.now() - tEmbed;

  const tDb = performance.now();
  const entryRows = new Map<string, EntryRow>();
  const noteRows = new Map<string, NoteRow>();
  const entryRankings: Ranking[] = [];
  const nameRankings: Ranking[] = [];

  const queryEntries = async (leg: SearchLeg, sql: string, params: unknown[]) => {
    const { rows } = await db.query<EntryRow>(sql, params);
    for (const r of rows) entryRows.set(r.id, r);
    entryRankings.push({ leg, ids: rows.map(r => r.id) });
  };
  const queryNotes = async (leg: SearchLeg, sql: string, params: unknown[]) => {
    const { rows } = await db.query<NoteRow>(sql, params);
    for (const r of rows) noteRows.set(r.note_id, r);
    nameRankings.push({ leg, ids: rows.map(r => r.note_id) });
  };

  const jobs: Promise<void>[] = [];
  queries.forEach((q, i) => {
    const norm = normalizeForMatch(q);
    const ts = buildTsQuery(q);
    if (on('fts') && ts) {
      jobs.push(
        queryEntries(
          'fts',
          `SELECT ${ENTRY_COLS} FROM entries e JOIN notes n ON n.id = e.note_id
           WHERE n.user_id = $1 ${CATEGORY_FILTER} AND e.tsv @@ to_tsquery('simple', immutable_unaccent($3))
           ORDER BY ts_rank_cd(e.tsv, to_tsquery('simple', immutable_unaccent($3))) DESC LIMIT ${ENTRY_LIMIT}`,
          [userId, category, ts],
        ),
      );
    }
    if (on('trgm')) {
      jobs.push(
        queryEntries(
          'trgm',
          `SELECT ${ENTRY_COLS} FROM entries e JOIN notes n ON n.id = e.note_id
           WHERE n.user_id = $1 ${CATEGORY_FILTER} AND $3 <% e.norm
           ORDER BY word_similarity($3, e.norm) DESC LIMIT ${ENTRY_LIMIT}`,
          [userId, category, norm],
        ),
      );
    }
    if (on('namesTrgm')) {
      jobs.push(
        queryNotes(
          'namesTrgm',
          `SELECT ${NOTE_COLS} FROM notes n
           WHERE n.user_id = $1 ${CATEGORY_FILTER} AND ($3 <% n.names OR n.names % $3)
           ORDER BY GREATEST(word_similarity($3, n.names), similarity(n.names, $3)) DESC LIMIT ${NAME_LIMIT}`,
          [userId, category, norm],
        ),
      );
    }
    const v = vectors[i];
    if (v && on('vec')) {
      jobs.push(
        queryEntries(
          'vec',
          `SELECT ${ENTRY_COLS} FROM entries e JOIN notes n ON n.id = e.note_id
           WHERE n.user_id = $1 ${CATEGORY_FILTER}
           ORDER BY e.embedding <=> $3::vector LIMIT ${ENTRY_LIMIT}`,
          [userId, category, toVectorLiteral(v)],
        ),
      );
    }
    if (v && on('namesVec')) {
      jobs.push(
        queryNotes(
          'namesVec',
          `SELECT ${NOTE_COLS} FROM notes n
           WHERE n.user_id = $1 ${CATEGORY_FILTER} AND n.name_embedding IS NOT NULL
           ORDER BY n.name_embedding <=> $3::vector LIMIT ${NAME_LIMIT}`,
          [userId, category, toVectorLiteral(v)],
        ),
      );
    }
  });
  await Promise.all(jobs);
  const dbMs = performance.now() - tDb;

  const k = opts.k ?? DEFAULT_RRF_K;
  const fusedEntries = reciprocalRankFusion(entryRankings, k);
  const fusedNames = reciprocalRankFusion(nameRankings, k);

  interface NoteAgg {
    score: number;
    legs: Set<string>;
    entryIds: string[];
  }
  const notes = new Map<string, NoteAgg>();
  const agg = (id: string): NoteAgg => {
    let a = notes.get(id);
    if (!a) notes.set(id, (a = { score: 0, legs: new Set(), entryIds: [] }));
    return a;
  };
  for (const e of fusedEntries) {
    const row = entryRows.get(e.id)!;
    const a = agg(row.note_id);
    e.legs.forEach(l => a.legs.add(l));
    if (a.entryIds.length < 3) {
      a.entryIds.push(e.id);
      a.score += e.score;
    }
  }
  for (const n of fusedNames) {
    const a = agg(n.id);
    a.score += n.score;
    n.legs.forEach(l => a.legs.add(l));
  }

  const top = [...notes.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  const meta = (id: string): NoteRow => noteRows.get(id) ?? entryRows.get(notes.get(id)!.entryIds[0]!)!;

  // Notes matched only by name have no matching entry lines yet: show their latest ones.
  const needLatest = top.filter(([, a]) => a.entryIds.length === 0).map(([id]) => id);
  const latest = new Map<string, SearchEntry[]>();
  if (needLatest.length) {
    const res = await db.query<{
      note_id: string;
      entry_key: string;
      entry_date: string | null;
      type: string;
      text: string;
    }>(
      `SELECT note_id::text, entry_key, entry_date::text, type, text FROM (
         SELECT e.*, row_number() OVER (PARTITION BY e.note_id ORDER BY e.entry_date DESC NULLS LAST, e.id DESC) AS rn
         FROM entries e WHERE e.note_id = ANY($1::bigint[])
       ) x WHERE rn <= 3 ORDER BY note_id, rn`,
      [needLatest],
    );
    for (const r of res.rows) {
      const list = latest.get(r.note_id) ?? [];
      list.push({ id: r.entry_key, date: r.entry_date, type: r.type, text: r.text });
      latest.set(r.note_id, list);
    }
  }

  const hits: SearchHit[] = top.map(([id, a]) => {
    const m = meta(id);
    const entries = a.entryIds.length
      ? a.entryIds.map(eid => {
          const r = entryRows.get(eid)!;
          return { id: r.entry_key, date: r.entry_date, type: r.type, text: r.text };
        })
      : (latest.get(id) ?? []);
    return {
      path: m.path,
      title: m.title,
      category: m.category,
      score: Math.round(a.score * 10000) / 10000,
      matchedBy: [...a.legs],
      entries,
    };
  });

  return { hits, timings: { embedMs: round(embedMs), dbMs: round(dbMs), totalMs: round(performance.now() - t0) } };
}

const round = (n: number) => Math.round(n * 100) / 100;
