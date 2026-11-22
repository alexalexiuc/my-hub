import { loadCorpus } from './corpus';
import { flagNum, rng, stats, timed, type Args, type Harness } from './lib';
import { writeSeedNotes } from './seed';

/** `remember` end to end (exact-name lookup + file write + embed + upsert), half appends, half new notes. */
export async function benchWrite(args: Args, h: Harness): Promise<Record<string, unknown>> {
  await writeSeedNotes(h);
  await h.svc.reindex({ full: true });
  const corpus = await loadCorpus();
  const n = flagNum(args, 'writes', 100);
  const rand = rng(7);
  const word = () => Array.from({ length: 9 }, () => String.fromCharCode(97 + Math.floor(rand() * 26))).join('');

  const wall: number[] = [];
  const server: number[] = [];
  let created = 0;
  for (let i = 0; i < n; i++) {
    const existing = corpus[i % corpus.length]!;
    const fresh = i % 2 === 1;
    const { value, ms } = await timed(() =>
      h.svc.remember({
        subject: fresh ? `${word()} ${word()}` : existing.title,
        text: `Bench entry ${i}: paid ${100 + i} MDL, works fine`,
        type: 'fact',
        category: fresh ? 'bench' : existing.category,
        date: '2026-11-21',
      }),
    );
    wall.push(ms);
    server.push(value.timings.totalMs);
    if (value.created) created++;
  }
  return { writes: n, createdNotes: created, wallMs: stats(wall), serverMs: stats(server) };
}
