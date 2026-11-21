import { execFile, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, hostname, tmpdir, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDb,
  createEmbeddingProvider,
  createNotesRuntime,
  type Db,
  type EmbeddingProvider,
  type NotesRuntime,
  type NotesService,
} from '@my-hub/notes';

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES_DIR = join(PACKAGE_DIR, 'fixtures');
const RESULTS_DIR = join(PACKAGE_DIR, 'results');

export interface Args {
  command: string;
  positional: string[];
  flags: Map<string, string>;
}

/** `bench <command> [positional...] [--flag value | --flag]` */
export function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) flags.set(a.slice(2), rest[++i]!);
      else flags.set(a.slice(2), 'true');
    } else positional.push(a);
  }
  return { command, positional, flags };
}

export const flagNum = (args: Args, name: string, fallback: number): number => {
  const v = Number(args.flags.get(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export interface Stats {
  n: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Latency summary of a sample (any unit). */
export function stats(samples: number[]): Stats {
  if (samples.length === 0) return { n: 0, min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const s = [...samples].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
  return {
    n: s.length,
    min: r2(s[0]!),
    mean: r2(s.reduce((a, b) => a + b, 0) / s.length),
    p50: r2(at(50)),
    p95: r2(at(95)),
    p99: r2(at(99)),
    max: r2(s.at(-1)!),
  };
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t };
}

/** mulberry32: small deterministic PRNG so synthetic corpora are identical between runs. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One result file per run. Metrics are nested objects of numbers; `meta` describes the environment. */
export interface BenchResult {
  meta: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: PACKAGE_DIR }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export async function collectMeta(args: Args, extra: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cpu = cpus();
  return {
    timestamp: new Date().toISOString(),
    gitSha: gitSha(),
    host: hostname(),
    cpuModel: cpu[0]?.model,
    cpuCount: cpu.length,
    totalMemMb: Math.round(totalmem() / 1048576),
    cgroupCpuLimit: await readCgroup('/sys/fs/cgroup/cpu.max'),
    cgroupMemLimit: await readCgroup('/sys/fs/cgroup/memory.max'),
    node: process.version,
    target: args.flags.get('target') ?? 'direct (in-process)',
    ...extra,
  };
}

async function readCgroup(path: string): Promise<string | null> {
  return (await readFile(path, 'utf8').catch(() => null))?.trim() ?? null;
}

/** Writes `results/<timestamp>-<sha>-<label>.json` and returns its path. */
export async function saveResult(result: BenchResult, label: string, outDir?: string): Promise<string> {
  const dir = outDir ?? RESULTS_DIR;
  await mkdir(dir, { recursive: true });
  const stamp = String(result.meta.timestamp).replace(/[:.]/g, '-');
  const file = join(dir, `${stamp}-${result.meta.gitSha}-${label}.json`);
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
  return file;
}

/** Prints a fixed-width table. */
export function printTable(title: string, header: string[], rows: (string | number)[][]): void {
  const cells = [header, ...rows.map(r => r.map(String))];
  const widths = header.map((_, i) => Math.max(...cells.map(r => r[i]!.length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  process.stdout.write(`\n${title}\n${line(header)}\n${widths.map(w => '-'.repeat(w)).join('  ')}\n`);
  for (const r of cells.slice(1)) process.stdout.write(`${line(r)}\n`);
}

/** Samples this process's RSS (and optionally a docker container's) while a benchmark runs. */
export class ResourceSampler {
  private timer: NodeJS.Timeout | null = null;
  private rss: number[] = [];
  private container: number[] = [];

  constructor(private readonly dockerContainer?: string) {}

  start(intervalMs = 250): void {
    let dockerBusy = false;
    const tick = () => {
      this.rss.push(process.memoryUsage().rss / 1048576);
      // `docker stats --no-stream` takes 1-2 s: run it asynchronously, one at a time, so it never blocks the
      // event loop that issues and times the requests being measured.
      if (this.dockerContainer && !dockerBusy) {
        dockerBusy = true;
        execFile(
          'docker',
          ['stats', '--no-stream', '--format', '{{.MemUsage}}', this.dockerContainer],
          { timeout: 5000 },
          (err, stdout) => {
            dockerBusy = false;
            if (err) return; // container stats are best effort
            const m = /([\d.]+)\s*(MiB|GiB|KiB)/.exec(stdout);
            if (m) this.container.push(Number(m[1]) * ({ KiB: 1 / 1024, MiB: 1, GiB: 1024 }[m[2]!] ?? 1));
          },
        );
      }
    };
    tick();
    this.timer = setInterval(tick, intervalMs);
  }

  stop(): { processRssMb: { idle: number; peak: number }; containerMb?: { peak: number } } {
    if (this.timer) clearInterval(this.timer);
    const out = {
      processRssMb: { idle: r2(this.rss[0] ?? 0), peak: r2(Math.max(0, ...this.rss)) },
      ...(this.container.length ? { containerMb: { peak: r2(Math.max(...this.container)) } } : {}),
    };
    this.rss = [];
    this.container = [];
    return out;
  }
}

export interface Harness {
  runtime: NotesRuntime;
  svc: NotesService;
  embedder: EmbeddingProvider;
  db: Db;
  root: string;
  schema: string;
  userDir: string;
  dbVersion: string;
  cleanup: () => Promise<void>;
}

/**
 * An isolated in-process notes stack: its own Postgres schema and temp directory, so the real notes repo and
 * index are never touched. `cleanup()` drops both.
 */
export async function createHarness(args: Args, shared?: EmbeddingProvider): Promise<Harness> {
  const url = process.env.NOTES_BENCH_DATABASE_URL ?? process.env.NOTES_DATABASE_URL;
  if (!url) throw new Error('Set NOTES_BENCH_DATABASE_URL (or NOTES_DATABASE_URL): Postgres with pgvector.');
  const schema = `bench_${Date.now().toString(36)}`;
  const root = await mkdtemp(join(tmpdir(), 'notes-bench-'));
  const db = await createDb({ connectionString: url, schema, max: 16 });
  // `shared` reuses an already loaded model, so one run never holds two copies in memory.
  const embedder =
    shared ?? createEmbeddingProvider(args.flags.get('provider') ?? process.env.EMBEDDINGS_PROVIDER ?? 'e5');
  const runtime = await createNotesRuntime({ db, embedder, root });
  const svc = runtime.forUser('bench');
  const dbVersion = (await db.query<{ v: string }>('SHOW server_version')).rows[0]!.v;
  return {
    runtime,
    svc,
    embedder,
    db,
    root,
    schema,
    userDir: join(root, 'bench'),
    dbVersion,
    cleanup: async () => {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => undefined);
      await runtime.close().catch(() => undefined);
      await rm(root, { recursive: true, force: true });
    },
  };
}

export const providerMeta = (e: EmbeddingProvider) => ({
  embeddingProvider: e.name,
  embeddingModel: e.model,
  embeddingDimensions: e.dimensions,
  ...(e.name === 'fake'
    ? { warning: 'FakeProvider: vector relevance numbers are meaningless; only lexical legs are informative.' }
    : {}),
});
