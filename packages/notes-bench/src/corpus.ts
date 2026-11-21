/**
 * The hand-written bench data, parsed in memory on every run (nothing generated is committed):
 *   fixtures/corpus.txt -> seed notes (`<category>/<slug>.md`, deterministic entry ids)
 *   fixtures/golden.txt -> golden queries (query -> expected note path)
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { slugify } from '@my-hub/notes';
import { FIXTURES_DIR } from './lib';

export interface CorpusNote {
  category: string;
  title: string;
  aliases: string[];
  path: string;
  entries: { date: string; type: string; text: string; id: string }[];
}

export function parseCorpus(source: string): CorpusNote[] {
  const notes: CorpusNote[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('# ')) {
      const parts = line
        .slice(2)
        .split('|')
        .map(s => s.trim());
      const [category, title, aliases = ''] = parts as [string, string, string?];
      const path = `${category}/${slugify(title)}.md`;
      notes.push({
        category,
        title,
        aliases: aliases
          .split(';')
          .map(s => s.trim())
          .filter(Boolean),
        path,
        entries: [],
      });
      continue;
    }
    const m = /^(\d{4}-\d{2}-\d{2}) (\S+) (.+)$/.exec(line);
    if (!m || notes.length === 0) throw new Error(`Bad corpus line: ${line}`);
    const note = notes.at(-1)!;
    const id = createHash('sha1').update(`${note.path}:${note.entries.length}:${m[3]}`).digest('hex').slice(0, 4);
    note.entries.push({ date: m[1]!, type: m[2]!, text: m[3]!, id });
  }
  return notes;
}

/** Markdown for one corpus note, in the app's file format. */
export function renderNote(n: CorpusNote): string {
  const updated =
    n.entries
      .map(e => e.date)
      .sort()
      .at(-1) ?? '2026-01-01';
  const fm = [
    '---',
    `title: ${n.title}`,
    `category: ${n.category}`,
    'tags: []',
    `aliases: [${n.aliases.join(', ')}]`,
    `updated: ${updated}`,
    '---',
    '',
  ];
  return [...fm, ...n.entries.map(e => `- ${e.date} [${e.type}] ${e.text} ^${e.id}`)].join('\n') + '\n';
}

export interface GoldenQuery {
  query: string;
  /** Extra phrasings Claude would send alongside the query (translations, synonyms). Optional. */
  variants?: string[];
  expected_path: string;
  lang: string;
  kind: string;
}

export function parseGolden(source: string, notes: CorpusNote[]): GoldenQuery[] {
  const byTitle = new Map(notes.map(n => [n.title, n.path]));
  const out: GoldenQuery[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(\w+) \| (\w+) \| (.+?) => (.+)$/.exec(line);
    if (!m) throw new Error(`Bad golden line: ${line}`);
    const path = byTitle.get(m[4]!.trim());
    if (!path) throw new Error(`Golden query "${m[3]}" expects unknown note "${m[4]}"`);
    const [query, variantText] = m[3]!.split(' ~ ') as [string, string?];
    const variants = variantText
      ?.split(';')
      .map(v => v.trim())
      .filter(Boolean);
    out.push({
      query: query.trim(),
      ...(variants?.length ? { variants } : {}),
      expected_path: path,
      lang: m[2]!,
      kind: m[1]!,
    });
  }
  return out;
}

/** Parses `fixtures/corpus.txt`. */
export async function loadCorpus(): Promise<CorpusNote[]> {
  return parseCorpus(await readFile(join(FIXTURES_DIR, 'corpus.txt'), 'utf8'));
}

/** Parses `fixtures/golden.txt`, resolving each expected title to its corpus note path. */
export async function loadGolden(): Promise<GoldenQuery[]> {
  return parseGolden(await readFile(join(FIXTURES_DIR, 'golden.txt'), 'utf8'), await loadCorpus());
}
