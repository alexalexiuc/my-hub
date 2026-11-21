import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEmbeddingProvider, type EmbeddingProvider } from '@my-hub/notes';
import { parseCorpus } from './build-fixtures';
import { FIXTURES_DIR, flagNum, printTable, providerMeta, stats, timed, type Args } from './lib';

/** Cold load, single-line latency and batch throughput of the embedding provider. */
export async function benchEmbed(args: Args, shared?: EmbeddingProvider): Promise<Record<string, unknown>> {
  const kind = args.flags.get('provider') ?? process.env.EMBEDDINGS_PROVIDER ?? 'e5';
  const embedder = shared ?? createEmbeddingProvider(kind);
  const corpus = parseCorpus(await readFile(join(FIXTURES_DIR, 'corpus.txt'), 'utf8'));
  const lines = corpus.flatMap(n => n.entries.map(e => e.text));
  const line = (i: number) => lines[i % lines.length]!;

  const cold = await timed(async () => {
    await embedder.ready();
    await embedder.embedQueries(['warmup']);
  });

  const n = flagNum(args, 'n', 1000);
  const single: number[] = [];
  for (let i = 0; i < n; i++) single.push((await timed(() => embedder.embedPassages([line(i)]))).ms);

  const batches = 20;
  const batchSize = 32;
  const t = performance.now();
  for (let b = 0; b < batches; b++) {
    await embedder.embedPassages(Array.from({ length: batchSize }, (_, i) => line(b * batchSize + i)));
  }
  const linesPerSec = Math.round(((batches * batchSize) / (performance.now() - t)) * 1000);
  const singleLineMs = stats(single);

  printTable(
    `embed (${embedder.name})`,
    ['metric', 'value'],
    [
      ['cold load (ms)', Math.round(cold.ms)],
      ['single line p50 / p95 (ms)', `${singleLineMs.p50} / ${singleLineMs.p95}`],
      ['batch of 32 (lines/s)', linesPerSec],
    ],
  );

  return {
    ...providerMeta(embedder),
    coldLoadMs: Math.round(cold.ms),
    singleLineMs,
    batch32LinesPerSec: linesPerSec,
  };
}
