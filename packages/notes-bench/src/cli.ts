import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { benchEmbed } from './bench-embed';
import { benchRelevance } from './bench-relevance';
import { benchLists } from './bench-lists';
import { benchResolve } from './bench-resolve';
import { benchSearch } from './bench-search';
import { benchWrite } from './bench-write';
import { parseCorpus } from './build-fixtures';
import { callJson, directClient, mcpClient, type SearchClient } from './clients';
import { compare } from './compare';
import {
  FIXTURES_DIR,
  ResourceSampler,
  collectMeta,
  createHarness,
  parseArgs,
  printTable,
  providerMeta,
  saveResult,
  type Args,
  type Harness,
} from './lib';

const HELP = `notes-bench <command> [flags]

Commands
  all                 embed + relevance + write + search (default tiers 1k,10k) -> one result file
  embed               cold load, single-line latency, batch throughput
  write               remember end to end
  search              search latency per tier and concurrency   (--tier 1k,10k,50k,100k)
  relevance           recall@1 / recall@5 / MRR per config      (--config fts,trigram,vector,hybrid,hybrid-multi)
  lists               whole-list questions (places, foods): items reaching Claude per storage shape
  resolve             remember subject matching: sweep match threshold x vector floor (--verbose: raw scores)
  seed --target URL   load the seed corpus into the token's user through notes_remember (WRITES DATA)
  compare A.json B.json   diff two result files, flag regressions

Flags
  --provider e5|ollama|fake     embedding provider (direct mode; default $EMBEDDINGS_PROVIDER or e5)
  --target https://mcp.example  run search/relevance through the MCP endpoint of a deployed server
  --token T | --client-id I --client-secret S   credentials for --target (or NOTES_BENCH_* env vars)
  --docker-container NAME       also sample that container's memory while running
  --out DIR                     result directory (default packages/notes-bench/results)
  --no-save                     print only
Environment
  NOTES_BENCH_DATABASE_URL      Postgres with pgvector (direct mode; uses an isolated schema and a temp directory)
`;

async function seedRemote(args: Args): Promise<void> {
  const target = args.flags.get('target');
  if (!target) throw new Error('seed needs --target');
  if (!args.flags.has('yes')) {
    throw new Error('seed WRITES ~230 entries into the notes of the account behind the token. Re-run with --yes.');
  }
  const client = await mcpClient(target, args);
  const corpus = parseCorpus(await readFile(join(FIXTURES_DIR, 'corpus.txt'), 'utf8'));
  let n = 0;
  for (const note of corpus) {
    for (const e of note.entries) {
      await callJson(client.raw, 'notes_remember', {
        subject: note.title,
        text: e.text,
        type: e.type,
        date: e.date,
        path: note.path,
        category: note.category,
        aliases: note.aliases,
      });
      n++;
    }
  }
  await client.close();
  process.stdout.write(`seeded ${n} entries in ${corpus.length} notes\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { command } = args;
  if (command === 'help' || args.flags.has('help')) return void process.stdout.write(HELP);
  if (command === 'compare') {
    const [a, b] = args.positional;
    if (!a || !b) throw new Error('Usage: compare <a.json> <b.json>');
    const { regressions } = await compare(a, b);
    process.exitCode = regressions > 0 && args.flags.has('fail') ? 2 : 0;
    return;
  }
  if (command === 'seed') return seedRemote(args);

  const target = args.flags.get('target');
  const metrics: Record<string, unknown> = {};
  let harness: Harness | undefined;
  let client: SearchClient | undefined;
  const sampler = new ResourceSampler(args.flags.get('docker-container'));
  let providerInfo: Record<string, unknown> = {};
  let dbVersion: string | undefined;

  try {
    if (target && ['write', 'embed', 'resolve', 'lists'].includes(command)) {
      throw new Error(
        `"${command}" measures the local process; run it without --target (inside the server container).`,
      );
    }
    const needsHarness = !target;
    if (command === 'embed' && !target) {
      /* embed needs no database */
    } else if (needsHarness) {
      harness = await createHarness(args);
      providerInfo = providerMeta(harness.embedder);
      dbVersion = harness.dbVersion;
    }
    if (target) client = await mcpClient(target, args);
    else if (harness) client = directClient(harness);

    sampler.start();
    const run = async (name: string, fn: () => Promise<unknown>) => {
      process.stdout.write(`\n== ${name} ==\n`);
      metrics[name] = await fn();
    };
    const all = command === 'all';
    if ((all && !target) || command === 'embed') {
      await run('embed', () => benchEmbed(args, harness?.embedder));
      // embed alone has no harness; name the result file after the provider it measured
      if (!harness)
        providerInfo = { embeddingProvider: (metrics.embed as { embeddingProvider: string }).embeddingProvider };
    }
    if (all || command === 'relevance')
      await run('relevance', () => benchRelevance(args, { client: client!, harness: target ? undefined : harness }));
    if (((all && !target) || command === 'write') && harness) {
      await run('write', async () => {
        const fresh = await createHarness(args, harness?.embedder);
        try {
          return await benchWrite(args, fresh);
        } finally {
          await fresh.cleanup();
        }
      });
    }
    if (command === 'resolve' && harness) await run('resolve', () => benchResolve(args, harness!));
    if (command === 'lists' && harness) await run('lists', () => benchLists(args, harness!));
    if (all || command === 'search')
      await run('search', () => benchSearch(args, { client: client!, harness: target ? undefined : harness }));
    if (!['all', 'embed', 'write', 'search', 'relevance', 'resolve', 'lists'].includes(command))
      throw new Error(`Unknown command "${command}"\n\n${HELP}`);

    metrics.resources = sampler.stop();
    printTable(
      'resources',
      ['metric', 'MB'],
      [
        [
          'process RSS idle (first sample)',
          (metrics.resources as { processRssMb: { idle: number } }).processRssMb.idle,
        ],
        ['process RSS peak', (metrics.resources as { processRssMb: { peak: number } }).processRssMb.peak],
      ],
    );
    if (target)
      process.stdout.write(
        'Note: process RSS above is the bench client; use --docker-container (run on the server host) for the server.\n',
      );

    if (!args.flags.has('no-save')) {
      const result = { meta: await collectMeta(args, { command, dbVersion, ...providerInfo }), metrics };
      process.stdout.write(
        `\nresult: ${await saveResult(result, `${command}-${providerInfo.embeddingProvider ?? 'remote'}`, args.flags.get('out'))}\n`,
      );
    }
  } finally {
    await client?.close().catch(() => undefined);
    await harness?.cleanup();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
