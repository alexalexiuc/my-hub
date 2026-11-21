import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FIXTURES_DIR, printTable, type Args, type Harness } from './lib';
import { copySeedNotes } from './seed';

interface ResolveCase {
  subject: string;
  /** Note the subject names (a duplicate of it when it is not an exact title/alias), or null for a new subject. */
  expect: string | null;
  kind: string;
}

interface CaseResult {
  subject: string;
  kind: string;
  expect: string | null;
  /** `remember` appended to an existing note (exact title/alias/slug match) instead of creating one. */
  appendedTo: string | null;
  /** 1-based rank of `expect` among the review suggestions of the note `remember` created; null when absent. */
  rank: number | null;
  topSuggestion: string | null;
  topScore: number | null;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Review suggestions against the seed corpus. `remember` no longer guesses, so a near-duplicate subject becomes a new
 * unreviewed note; this measures whether the review queue then shows the note it duplicates among its `similar`
 * notes (rank 1 / within 3 / within 5) and how many positive subjects were already caught by the exact match.
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

  const results: CaseResult[] = [];
  for (const c of cases) {
    const res = await harness.svc.remember({
      subject: c.subject,
      text: 'Bench entry: checked it, works fine',
      type: 'fact',
      category: 'bench',
      date: '2026-11-21',
    });
    const result: CaseResult = {
      subject: c.subject,
      kind: c.kind,
      expect: c.expect,
      appendedTo: res.created ? null : res.path,
      rank: null,
      topSuggestion: null,
      topScore: null,
    };
    if (res.created) {
      // Everything created earlier was marked reviewed below, so the queue holds just this note.
      const queue = await harness.svc.reviewQueue({ limit: 1, suggestions: 5 });
      const item = queue.items.find(i => i.note.path === res.path);
      const similar = item?.similar ?? [];
      const idx = c.expect ? similar.findIndex(s => s.path === c.expect) : -1;
      result.rank = idx === -1 ? null : idx + 1;
      result.topSuggestion = similar[0]?.title ?? null;
      result.topScore = similar[0]?.score === undefined ? null : r3(similar[0].score);
      await harness.svc.markReviewed([res.path]);
    }
    results.push(result);
  }

  const kinds = [...new Set(cases.filter(c => c.expect !== null).map(c => c.kind))];
  const rows: (string | number)[][] = [];
  const summarize = (label: string, rs: CaseResult[]) => {
    const created = rs.filter(r => r.appendedTo === null);
    const within = (n: number) => created.filter(r => r.rank !== null && r.rank <= n).length;
    rows.push([
      label,
      rs.length,
      rs.filter(r => r.appendedTo !== null && r.appendedTo === r.expect).length,
      rs.filter(r => r.appendedTo !== null && r.appendedTo !== r.expect).length,
      created.length,
      `${within(1)}/${created.length}`,
      `${within(3)}/${created.length}`,
      `${within(5)}/${created.length}`,
    ]);
  };
  for (const kind of kinds)
    summarize(
      kind,
      results.filter(r => r.kind === kind && r.expect !== null),
    );
  summarize(
    'all positive',
    results.filter(r => r.expect !== null),
  );
  printTable(
    `review suggestions: ${cases.length} subjects through remember, then reviewQueue similar (top 5)`,
    ['kind', 'cases', 'appended (exact)', 'appended wrong', 'new note', 'similar @1', '@<=3', '@<=5'],
    rows,
  );

  const negatives = results.filter(r => r.expect === null);
  const negativeRows = negatives.map(r => [
    r.subject,
    r.kind,
    r.appendedTo === null ? 'new note' : `APPENDED to ${r.appendedTo}`,
    r.topSuggestion ?? '-',
    r.topScore ?? '-',
  ]);
  printTable(
    'review suggestions: subjects that are new things (expect null), top suggestion shown for information',
    ['subject', 'kind', 'remember', 'top suggestion', 'score'],
    negativeRows,
  );

  if (args.flags.has('verbose')) {
    printTable(
      'review suggestions: every positive case',
      ['subject', 'expect', 'remember', 'rank', 'top suggestion', 'score'],
      results
        .filter(r => r.expect !== null)
        .map(r => [
          r.subject,
          r.expect!,
          r.appendedTo === null ? 'new note' : `appended ${r.appendedTo}`,
          r.rank ?? '-',
          r.topSuggestion ?? '-',
          r.topScore ?? '-',
        ]),
    );
  }
  return { cases: cases.length, results };
}
