import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SearchHit } from '@my-hub/notes';
import { FIXTURES_DIR, createHarness, printTable, type Args, type Harness } from './lib';
import { writeSeedNotes } from './seed';

interface ListItem {
  key: string;
  name: string;
  text: string;
}

interface ListCase {
  id: string;
  title: string;
  category: string;
  aliases: string[];
  queries: string[];
  items: ListItem[];
}

/** How the items were saved: one list note, or one note per item. */
type Shape = 'list' | 'notes';

const has = (haystack: string, key: string) => haystack.toLowerCase().includes(key.toLowerCase());

/** Items whose key shows up in what Claude sees from search: note titles and the returned entry lines. */
function itemsInHits(items: ListItem[], hits: SearchHit[]): number {
  return items.filter(i => hits.some(h => has(h.title, i.key) || h.entries.some(e => has(e.text, i.key)))).length;
}

/** Saves every list through `remember`, the way Claude would, in one of the two shapes. */
async function store(h: Harness, lists: ListCase[], shape: Shape) {
  const notesCreated: Record<string, number> = {};
  /** Saves that landed in another item's note (exact title/alias collisions). */
  const incidents: string[] = [];
  for (const l of lists) {
    const paths = new Map<string, string>();
    for (const i of l.items) {
      const input =
        shape === 'list'
          ? { subject: l.title, text: `${i.name}: ${i.text}`, type: 'fact', category: l.category, aliases: l.aliases }
          : { subject: i.name, text: `Want to try / visit: ${i.text}`, type: 'fact', category: l.category };
      const res = await h.svc.remember(input);
      if (shape === 'notes' && !res.created && paths.has(res.path)) {
        incidents.push(`wrong merge: "${i.name}" into "${res.title}"`);
      }
      paths.set(res.path, i.name);
    }
    notesCreated[l.id] = paths.size;
  }
  return { notesCreated, incidents };
}

/**
 * "Give me the whole list" questions (places to visit, foods to try): how many of a list's items reach Claude from
 * notes_search alone (limit 5 and 20), from search + notes_read of the hits, from notes_browse (ranked by the list's
 * queries, limit 50, then notes_read of the headers in the list's category; and by category alone), for each shape.
 */
export async function benchLists(args: Args, shared: Harness): Promise<Record<string, unknown>> {
  const { lists } = JSON.parse(await readFile(join(FIXTURES_DIR, 'list-cases.json'), 'utf8')) as { lists: ListCase[] };
  const rows: (string | number)[][] = [];
  const out: Record<string, unknown> = {};

  for (const shape of ['list', 'notes'] as Shape[]) {
    const h = await createHarness(args, shared.embedder);
    try {
      await writeSeedNotes(h);
      await h.svc.reindex({ full: true });
      const { notesCreated, incidents } = await store(h, lists, shape);
      out[`${shape}/incidents`] = incidents;
      for (const x of incidents) process.stdout.write(`[${shape}] ${x}\n`);
      for (const l of lists) {
        const n = l.items.length;
        const r: Record<string, number> = { items: n, notesCreated: notesCreated[l.id]! };
        for (const [label, queries] of [
          ['multi', l.queries],
          ['single', l.queries.slice(0, 1)],
        ] as const) {
          for (const limit of [5, 20]) {
            const res = await h.svc.search({ queries: [...queries], limit });
            r[`search_${label}_${limit}`] = itemsInHits(l.items, res.hits);
            // Then notes_read every hit that belongs to the list's category (what Claude does when snippets are not enough).
            const listHits = res.hits.filter(x => x.category === l.category);
            const read = await Promise.all(listHits.map(x => h.svc.read(x.path)));
            r[`read_${label}_${limit}`] = l.items.filter(i => read.some(x => has(x.content, i.key))).length;
            if (label === 'multi') r[`categoryHitsIn${limit}`] = listHits.length;
          }
        }
        const browsed = await h.svc.browse({ queries: [...l.queries], limit: 50 });
        const browsedRead = await Promise.all(
          browsed.filter(x => x.category === l.category).map(x => h.svc.read(x.path)),
        );
        r.browseQueryRead = l.items.filter(i => browsedRead.some(x => has(x.content, i.key))).length;
        const byCategory = await h.svc.browse({ category: l.category, limit: 200 });
        r.browseCategory = l.items.filter(i =>
          byCategory.some(x => has(x.title, i.key) || (x.firstLine !== null && has(x.firstLine, i.key))),
        ).length;
        out[`${shape}/${l.id}`] = r;
        rows.push([
          shape,
          l.id,
          `${r.notesCreated}`,
          `${r.search_multi_5}/${n}`,
          `${r.search_multi_20}/${n}`,
          `${r.read_multi_5}/${n}`,
          `${r.read_multi_20}/${n}`,
          `${r.read_single_5}/${n}`,
          `${r.browseQueryRead}/${n}`,
          `${r.browseCategory}/${n}`,
        ]);
      }
    } finally {
      await h.cleanup();
    }
  }

  printTable(
    'list recall: items that reach Claude (search queries = 4 phrasings unless "single")',
    [
      'shape',
      'list',
      'notes made',
      'search 5',
      'search 20',
      'search 5 + read',
      'search 20 + read',
      '1 query 5 + read',
      'browse q (50) + read',
      'browse cat',
    ],
    rows,
  );
  return out;
}
