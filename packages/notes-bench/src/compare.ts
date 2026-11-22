import { readFile } from 'node:fs/promises';
import { printTable, type BenchResult } from './lib';

function flatten(value: unknown, prefix = '', out = new Map<string, number>()): Map<string, number> {
  if (typeof value === 'number') out.set(prefix, value);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const isQuality = (key: string) => /recallAt|mrr|PerSec|requestsPerSec/i.test(key) && !/\.n$/.test(key);
const isCost = (key: string) => /(^|\.)(p50|p95|p99|mean|max|min)$|Ms$|Mb$|Rss|peak|idle/i.test(key);

/** Diffs two result files and flags regressions: cost up more than 20%, quality down more than 0.02 (or 10% for rates). */
export async function compare(aPath: string, bPath: string): Promise<{ regressions: number }> {
  const [a, b] = await Promise.all([aPath, bPath].map(async p => JSON.parse(await readFile(p, 'utf8')) as BenchResult));
  const fa = flatten(a!.metrics);
  const fb = flatten(b!.metrics);
  const rows: (string | number)[][] = [];
  let regressions = 0;
  for (const [key, x] of fa) {
    const y = fb.get(key);
    if (y === undefined || x === y) continue;
    const delta = x === 0 ? Infinity : (y - x) / Math.abs(x);
    let flag = '';
    if (isQuality(key)) {
      const rate = /PerSec/i.test(key);
      if (rate ? delta < -0.1 : y - x < -0.02) flag = 'REGRESSION';
    } else if (isCost(key) && delta > 0.2) flag = 'REGRESSION';
    if (flag) regressions++;
    rows.push([key, x, y, `${delta >= 0 ? '+' : ''}${Number.isFinite(delta) ? Math.round(delta * 100) : '∞'}%`, flag]);
  }
  process.stdout.write(`A: ${a!.meta.timestamp} ${a!.meta.gitSha} ${a!.meta.embeddingProvider ?? ''}\n`);
  process.stdout.write(`B: ${b!.meta.timestamp} ${b!.meta.gitSha} ${b!.meta.embeddingProvider ?? ''}\n`);
  printTable('differences', ['metric', 'A', 'B', 'change', ''], rows);
  process.stdout.write(`\n${regressions} regression(s)\n`);
  return { regressions };
}
