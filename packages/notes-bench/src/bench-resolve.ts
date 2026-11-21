import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_RESOLVE_CONFIG, decide, findCandidates, type Candidate, type ResolveConfig } from '@my-hub/notes';
import { FIXTURES_DIR, printTable, type Args, type Harness } from './lib';
import { copySeedNotes } from './seed';

interface ResolveCase {
  subject: string;
  /** Note path the subject must merge into, or null when it must become a new note. */
  expect: string | null;
  kind: string;
}

type Outcome = 'correct' | 'wrongMerge' | 'missedMerge' | 'ambiguous';

const FLOORS = [0.6, 0.65, 0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.85, 0.88];
const THRESHOLDS = [0.4, 0.45, 0.5, 0.55, 0.6, 0.625, 0.65, 0.675, 0.7, 0.75, 0.8];
const AMBIGUITY_MARGIN = DEFAULT_RESOLVE_CONFIG.ambiguityMargin;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function outcome(c: ResolveCase, candidates: Candidate[], config: ResolveConfig): Outcome {
  const r = decide(candidates, config);
  if (r.kind === 'ambiguous') return 'ambiguous';
  if (r.kind === 'none') return c.expect === null ? 'correct' : 'missedMerge';
  return r.candidate.path === c.expect ? 'correct' : 'wrongMerge';
}

/**
 * `remember` subject resolution against the seed corpus: sweeps NOTES_MATCH_VECTOR_FLOOR x NOTES_MATCH_THRESHOLD and
 * counts wrong merges (two subjects mixed into one note, the costly error), missed merges (a duplicate note) and
 * ambiguous answers (Claude has to ask). Also reports the raw cosine of the right note vs. the best wrong one.
 */
export async function benchResolve(args: Args, harness: Harness): Promise<Record<string, unknown>> {
  await copySeedNotes(harness);
  await harness.svc.reindex({ full: true });
  const { cases } = JSON.parse(await readFile(join(FIXTURES_DIR, 'resolve-cases.json'), 'utf8')) as {
    cases: ResolveCase[];
  };
  const known = new Set(
    (await harness.db.query<{ path: string }>('SELECT path FROM notes WHERE user_id = $1', ['bench'])).rows.map(
      r => r.path,
    ),
  );
  const unknown = cases.filter(c => c.expect && !known.has(c.expect));
  if (unknown.length)
    throw new Error(`resolve-cases.json names missing notes: ${unknown.map(c => c.expect).join(', ')}`);

  // Candidate lists depend on the floor only through their LIMIT ordering, so fetch them once per floor.
  const byFloor = new Map<number, Candidate[][]>();
  for (const vectorFloor of FLOORS) {
    const config = { threshold: 0, vectorFloor, ambiguityMargin: AMBIGUITY_MARGIN };
    const lists: Candidate[][] = [];
    for (const c of cases) lists.push(await findCandidates(harness.db, harness.embedder, 'bench', c.subject, config));
    byFloor.set(vectorFloor, lists);
  }

  const grid: Record<string, unknown>[] = [];
  for (const vectorFloor of FLOORS) {
    const lists = byFloor.get(vectorFloor)!;
    for (const threshold of THRESHOLDS) {
      const config = { threshold, vectorFloor, ambiguityMargin: AMBIGUITY_MARGIN };
      const counts: Record<Outcome, number> = { correct: 0, wrongMerge: 0, missedMerge: 0, ambiguous: 0 };
      const wrong: string[] = [];
      cases.forEach((c, i) => {
        const o = outcome(c, lists[i]!, config);
        counts[o]++;
        if (o === 'wrongMerge') wrong.push(c.subject);
      });
      grid.push({ vectorFloor, threshold, ...counts, wrongMerges: wrong });
    }
  }
  // Best = fewest wrong merges, then most correct, then fewest ambiguous.
  const ranked = [...grid].sort(
    (a, b) =>
      (a.wrongMerge as number) - (b.wrongMerge as number) ||
      (b.correct as number) - (a.correct as number) ||
      (a.ambiguous as number) - (b.ambiguous as number),
  );

  // Raw cosine: the right note's similarity (positives) vs. the best similarity to any note (negatives).
  const lists = byFloor.get(FLOORS[0]!)!;
  const perCase = cases.map((c, i) => {
    const cands = lists[i]!;
    const right = c.expect ? cands.find(x => x.path === c.expect) : undefined;
    const bestOther = cands.filter(x => x.path !== c.expect).sort((a, b) => b.cosine - a.cosine)[0];
    return {
      subject: c.subject,
      kind: c.kind,
      expect: c.expect,
      rightCosine: right ? r3(right.cosine) : null,
      rightTrigram: right ? r3(right.trigram) : null,
      bestOtherCosine: bestOther ? r3(bestOther.cosine) : null,
      bestOther: bestOther?.path ?? null,
    };
  });

  printTable(
    `resolve: best 10 of ${grid.length} (floor x threshold), ${cases.length} cases, margin ${AMBIGUITY_MARGIN}`,
    ['floor', 'threshold', 'correct', 'wrong merge', 'missed merge', 'ambiguous'],
    ranked
      .slice(0, 10)
      .map(g => [
        g.vectorFloor as number,
        g.threshold as number,
        g.correct as number,
        g.wrongMerge as number,
        g.missedMerge as number,
        g.ambiguous as number,
      ]),
  );
  const { vectorFloor: df, threshold: dt } = DEFAULT_RESOLVE_CONFIG;
  const current = grid.find(g => g.vectorFloor === df && g.threshold === dt);
  if (current) {
    process.stdout.write(
      `defaults (floor ${df}, threshold ${dt}): correct ${current.correct}, wrong merge ${current.wrongMerge} ` +
        `(${(current.wrongMerges as string[]).join(', ') || '-'}), missed ${current.missedMerge}, ambiguous ${current.ambiguous}\n`,
    );
  }
  if (args.flags.has('verbose')) {
    printTable(
      'resolve: raw scores per case',
      ['subject', 'expect', 'right cos', 'right trgm', 'best other cos', 'best other'],
      perCase.map(p => [
        p.subject,
        p.expect ?? '(new)',
        p.rightCosine ?? '-',
        p.rightTrigram ?? '-',
        p.bestOtherCosine ?? '-',
        p.bestOther ?? '-',
      ]),
    );
  }
  return {
    cases: cases.length,
    ambiguityMargin: AMBIGUITY_MARGIN,
    defaults: current,
    best: ranked.slice(0, 10),
    grid,
    perCase,
  };
}
