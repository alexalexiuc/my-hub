import { directClient, type SearchClient } from './clients';
import { printTable, providerMeta, type Args, type Harness } from './lib';
import { writeSeedNotes, growTo } from './seed';
import type { SearchLeg } from '@my-hub/notes';
import { loadGolden, type GoldenQuery } from './corpus';

type Legs = Partial<Record<SearchLeg, boolean>>;
const only = (...on: SearchLeg[]): Legs =>
  Object.fromEntries(['fts', 'trgm', 'vec', 'namesTrgm', 'namesVec'].map(l => [l, on.includes(l as SearchLeg)]));

/** Search configurations compared by the relevance benchmark. Only `hybrid*` work through `--target`. */
const CONFIGS: Record<string, { legs?: Legs; multi: boolean; remote: boolean }> = {
  fts: { legs: only('fts'), multi: false, remote: false },
  trigram: { legs: only('trgm', 'namesTrgm'), multi: false, remote: false },
  vector: { legs: only('vec', 'namesVec'), multi: false, remote: false },
  hybrid: { multi: false, remote: true },
  'hybrid-multi': { multi: true, remote: true },
};

interface Metrics {
  n: number;
  recallAt1: number;
  recallAt5: number;
  mrr: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function metrics(ranks: number[]): Metrics {
  const n = ranks.length;
  if (n === 0) return { n: 0, recallAt1: 0, recallAt5: 0, mrr: 0 };
  return {
    n,
    recallAt1: r3(ranks.filter(r => r === 1).length / n),
    recallAt5: r3(ranks.filter(r => r > 0 && r <= 5).length / n),
    mrr: r3(ranks.reduce((s, r) => s + (r > 0 ? 1 / r : 0), 0) / n),
  };
}

/** recall@1, recall@5 and MRR per configuration, overall and split by kind and language. */
export async function benchRelevance(
  args: Args,
  target: { client: SearchClient; harness?: Harness },
): Promise<Record<string, unknown>> {
  const { client, harness } = target;
  if (harness) {
    await writeSeedNotes(harness);
    await harness.svc.reindex({ full: true });
    const filler = args.flags.get('filler');
    if (filler) await growTo(harness, Number(filler));
  }
  const golden = await loadGolden();
  const wanted = (args.flags.get('config') ?? Object.keys(CONFIGS).join(',')).split(',');
  const out: Record<string, unknown> = {};
  const rows: (string | number)[][] = [];

  for (const name of wanted) {
    const config = CONFIGS[name];
    if (!config) throw new Error(`Unknown config "${name}" (expected ${Object.keys(CONFIGS).join(', ')})`);
    if (!harness && !config.remote) continue;

    const ranks = new Map<GoldenQuery, number>();
    for (const g of golden) {
      const queries = config.multi && g.variants ? [g.query, ...g.variants] : [g.query];
      const res = await client.search(queries, { legs: config.legs, limit: 10 });
      ranks.set(g, res.paths.indexOf(g.expected_path) + 1);
    }
    const by = (pick: (g: GoldenQuery) => string) => {
      const groups: Record<string, Metrics> = {};
      for (const key of new Set(golden.map(pick))) {
        groups[key] = metrics(golden.filter(g => pick(g) === key).map(g => ranks.get(g)!));
      }
      return groups;
    };
    const overall = metrics(golden.map(g => ranks.get(g)!));
    const withVariants = metrics(golden.filter(g => g.variants).map(g => ranks.get(g)!));
    out[name] = { overall, withVariantsSubset: withVariants, byKind: by(g => g.kind), byLang: by(g => g.lang) };
    rows.push([name, overall.recallAt1, overall.recallAt5, overall.mrr, withVariants.recallAt5, withVariants.mrr]);
  }
  if (harness) process.stdout.write(`\nembedding provider: ${harness.embedder.name} (${harness.embedder.model})\n`);
  if (harness?.embedder.name === 'fake') {
    process.stdout.write('NOTE: FakeProvider in use - vector and hybrid numbers are NOT meaningful.\n');
  }
  printTable(
    `relevance over ${golden.length} golden queries`,
    ['config', 'recall@1', 'recall@5', 'MRR', 'recall@5 (variants subset)', 'MRR (variants subset)'],
    rows,
  );
  return { queries: golden.length, ...(harness ? providerMeta(harness.embedder) : {}), configs: out };
}

export { directClient };
