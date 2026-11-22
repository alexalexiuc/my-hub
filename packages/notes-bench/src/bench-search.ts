import { loadGolden } from './corpus';
import { directClient, type SearchClient } from './clients';
import { flagNum, printTable, rng, stats, type Args, type Harness, type Stats } from './lib';
import { countEntries, growTo, writeSeedNotes } from './seed';

const TIERS: Record<string, number> = { '1k': 1_000, '10k': 10_000, '50k': 50_000, '100k': 100_000 };

interface Load {
  wall: Stats;
  serverTotal: Stats;
  serverDb: Stats;
  serverEmbed: Stats;
  networkOverhead: Stats;
  requestsPerSec: number;
}

/** Runs `total` searches (4 distinct golden queries each) with `concurrency` parallel workers. */
async function load(client: SearchClient, total: number, concurrency: number, seed: number): Promise<Load> {
  const golden = await loadGolden();
  const rand = rng(seed);
  const next = (): string[] => {
    const picks = new Set<string>();
    while (picks.size < 4) picks.add(golden[Math.floor(rand() * golden.length)]!.query);
    return [...picks];
  };
  const wall: number[] = [];
  const total$: number[] = [];
  const db: number[] = [];
  const embed: number[] = [];
  const overhead: number[] = [];
  let issued = 0;
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (issued < total) {
        issued++;
        const res = await client.search(next());
        wall.push(res.wallMs);
        if (res.server) {
          total$.push(res.server.totalMs);
          db.push(res.server.dbMs);
          embed.push(res.server.embedMs);
          overhead.push(res.wallMs - res.server.totalMs);
        }
      }
    }),
  );
  const seconds = (performance.now() - t0) / 1000;
  return {
    wall: stats(wall),
    serverTotal: stats(total$),
    serverDb: stats(db),
    serverEmbed: stats(embed),
    networkOverhead: stats(overhead),
    requestsPerSec: Math.round((total / seconds) * 10) / 10,
  };
}

/** Search latency per data tier (direct mode grows synthetic data) and under concurrency. */
export async function benchSearch(
  args: Args,
  target: { client: SearchClient; harness?: Harness },
): Promise<Record<string, unknown>> {
  const { client, harness } = target;
  const requests = flagNum(args, 'requests', 200);
  const levels = (args.flags.get('concurrency') ?? '1,5,10').split(',').map(Number);
  // Smallest first: the harness only grows, so a larger tier measured first would leave nothing to measure at
  // the smaller one.
  const tierNames = harness
    ? (args.flags.get('tier') ?? '1k,10k').split(',').sort((a, b) => (TIERS[a] ?? 0) - (TIERS[b] ?? 0))
    : ['target'];
  const results: Record<string, unknown> = {};
  const rows: (string | number)[][] = [];

  if (harness) await writeSeedNotes(harness);
  for (const name of tierNames) {
    let seedingMs = 0;
    let entries: number | null = null;
    if (harness) {
      const goal = TIERS[name];
      if (!goal) throw new Error(`Unknown tier "${name}" (expected ${Object.keys(TIERS).join(', ')})`);
      const t = performance.now();
      await growTo(harness, goal);
      seedingMs = Math.round(performance.now() - t);
      // Record what was actually measured, and refuse a tier the harness has already outgrown.
      entries = await countEntries(harness);
      if (entries > goal * 1.1)
        throw new Error(`Tier "${name}" needs ~${goal} entries but the index already holds ${entries}.`);
    }
    await load(client, 20, 1, 1); // warm up
    const perLevel: Record<string, Load> = {};
    for (const c of levels) {
      perLevel[`concurrency${c}`] = await load(client, requests, c, 42 + c);
      const l = perLevel[`concurrency${c}`]!;
      rows.push([name, c, l.wall.p50, l.wall.p95, l.serverTotal.p95, l.serverDb.p95, l.requestsPerSec]);
    }
    results[name] = { entries, seedingMs, ...perLevel };
  }
  printTable(
    'search (4 query variants per request)',
    ['tier', 'conc', 'wall p50 ms', 'wall p95 ms', 'server p95', 'db p95', 'req/s'],
    rows,
  );
  return results;
}

export { directClient };
