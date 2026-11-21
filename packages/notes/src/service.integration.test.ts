import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './db';
import { FakeProvider } from './embeddings';
import { NotesRuntime, createNotesRuntime } from './service';

/** Needs Postgres with pgvector, pg_trgm and unaccent: NOTES_TEST_DATABASE_URL=postgres://user:pass@host/db */
const url = process.env.NOTES_TEST_DATABASE_URL;

describe.skipIf(!url)('NotesService (integration, FakeProvider)', () => {
  let root: string;
  let rt: NotesRuntime;
  const schema = `notes_test_${process.pid}`;
  const user = 'user-a';
  const svc = () => rt.forUser(user);

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'notes-it-'));
    const db = await createDb({ connectionString: url!, schema });
    rt = await createNotesRuntime({ db, embedder: new FakeProvider(64), root });
  });

  afterAll(async () => {
    await rt.db.query(`DROP SCHEMA ${schema} CASCADE`);
    await rt.close();
    await rm(root, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await svc().deleteAll();
    await rt.forUser('user-b').deleteAll();
  });

  const remember = (subject: string, text: string, extra: Record<string, unknown> = {}) =>
    svc().remember({ subject, text, type: 'fact', date: '2026-11-21', category: 'services', ...extra });

  const gitLog = () =>
    execFileSync('git', ['log', '--format=%s'], { cwd: join(root, user) })
      .toString()
      .trim()
      .split('\n');

  it('creates a note on first remember and appends on the second', async () => {
    const first = await remember('Carpet cleaning', 'CleanPro, 069xxxxxx', {
      aliases: ['covoare', 'химчистка ковров'],
    });
    expect(first).toMatchObject({ status: 'saved', created: true, path: 'services/carpet-cleaning.md' });

    const second = await remember('carpet cleaning', '450 MDL for 3 rugs', { type: 'price' });
    expect(second).toMatchObject({ status: 'saved', created: false, path: 'services/carpet-cleaning.md' });

    const entries = await svc().entries('services/carpet-cleaning.md');
    expect(entries.map(e => e.type)).toEqual(['fact', 'price']);

    const file = await readFile(join(root, user, 'services/carpet-cleaning.md'), 'utf8');
    expect(file).toMatch(/^---\ntitle: Carpet cleaning\ncategory: services\n/);
    expect(file).toContain('aliases: [covoare, химчистка ковров]');
  });

  it('appends when the subject equals an existing title exactly', async () => {
    await remember('Carpet cleaning', 'CleanPro');
    const res = await remember('CARPET CLEANING', 'second visit was fine');
    expect(res).toMatchObject({ created: false, path: 'services/carpet-cleaning.md', matchedBy: 'path' });
    expect(await svc().entries('services/carpet-cleaning.md')).toHaveLength(2);
  });

  it('appends when the subject equals an alias, ignoring case and accents', async () => {
    await remember('Carpet cleaning', 'CleanPro', { aliases: ['Curățare covoare'] });
    const res = await remember('curatare COVOARE', 'second visit was fine');
    expect(res).toMatchObject({ created: false, path: 'services/carpet-cleaning.md', matchedBy: 'name' });
  });

  it('makes one git commit per write', async () => {
    const a = await remember('Engine oil', '5W-30 Castrol', { category: 'car' });
    await remember('Engine oil', 'changed at 120000 km', { category: 'car' });
    const log = gitLog();
    expect(log).toHaveLength(2);
    expect(log[1]).toBe(`notes(car/engine-oil): +entry ^${a.entryId}`);
  });

  it('finds notes by exact words, by typo and by alias', async () => {
    await remember('Carpet cleaning', 'CleanPro, 069xxxxxx, picked up from the flat', { aliases: ['rug cleaning'] });
    await remember('Washing detergent', 'Ariel powder smells great', { category: 'home' });

    const exact = await svc().search({ queries: ['CleanPro'] });
    expect(exact.hits[0]?.path).toBe('services/carpet-cleaning.md');
    expect(exact.hits[0]?.entries[0]?.text).toContain('CleanPro');

    const typo = await svc().search({ queries: ['clenpro'] });
    expect(typo.hits[0]?.path).toBe('services/carpet-cleaning.md');
    expect(typo.hits[0]?.matchedBy).toContain('trgm');

    const alias = await svc().search({ queries: ['rug cleaning'] });
    expect(alias.hits[0]?.path).toBe('services/carpet-cleaning.md');

    // The vector legs always return nearest neighbours, so check the category filter on lexical legs only.
    const lexical = { vec: false, namesVec: false };
    expect((await svc().search({ queries: ['ariel'], category: 'services', legs: lexical })).hits).toHaveLength(0);
    expect((await svc().search({ queries: ['ariel'], category: 'home', legs: lexical })).hits[0]?.path).toBe(
      'home/washing-detergent.md',
    );
  });

  it('reports timings and honours the leg switches', async () => {
    await remember('Carpet cleaning', 'CleanPro');
    const res = await svc().search({ queries: ['cleanpro'], legs: { vec: false, namesVec: false } });
    expect(res.timings.totalMs).toBeGreaterThan(0);
    expect(res.timings.embedMs).toBe(0);
    expect(res.hits[0]?.matchedBy).not.toContain('vec');
  });

  it('edits and deletes a single entry', async () => {
    const r = await remember('Carpet cleaning', 'CleanPro, 450 MDL');
    await svc().editEntry(r.path, r.entryId, { text: 'CleanPro, 500 MDL', type: 'price' });
    expect((await svc().entries(r.path))[0]).toMatchObject({ text: 'CleanPro, 500 MDL', type: 'price' });
    expect((await svc().search({ queries: ['500'] })).hits[0]?.entries[0]?.text).toContain('500');
    expect((await svc().search({ queries: ['450'], legs: { vec: false, namesVec: false } })).hits).toHaveLength(0);

    await svc().deleteEntry(r.path, r.entryId);
    expect(await svc().entries(r.path)).toHaveLength(0);
    await expect(svc().deleteEntry(r.path, r.entryId)).rejects.toThrow(/No entry/);
  });

  it('adds an alias without duplicating it', async () => {
    const r = await remember('Carpet cleaning', 'CleanPro');
    await svc().addAlias(r.path, 'covoare');
    const again = await svc().addAlias(r.path, 'Covoare');
    expect(again.aliases).toEqual(['covoare']);
    expect((await svc().search({ queries: ['covoare'] })).hits[0]?.path).toBe(r.path);
  });

  it('creates a second, unreviewed note for a near name instead of guessing', async () => {
    const a = await remember('Engine oil castrol', 'a', { category: 'car' });
    const b = await remember('Engine oil mobil', 'b', { category: 'car' });
    expect(a).toMatchObject({ created: true, matchedBy: null });
    expect(b).toMatchObject({ created: true, path: 'car/engine-oil-mobil.md', matchedBy: null });
    const file = await readFile(join(root, user, 'car/engine-oil-mobil.md'), 'utf8');
    expect(file).toContain('updated: 2026-11-21\nreviewed: false\n');
    expect((await svc().browse({ unreviewedOnly: true })).map(n => n.path)).toEqual([
      'car/engine-oil-castrol.md',
      'car/engine-oil-mobil.md',
    ]);
  });

  it('writes to an explicit path, creating it when missing', async () => {
    await remember('Castrol edge', 'a', { category: 'car' });
    const forced = await svc().remember({ subject: 'Anything', text: 'c', type: 'fact', path: 'car/castrol-edge.md' });
    expect(forced).toMatchObject({ created: false, path: 'car/castrol-edge.md', matchedBy: 'path' });
    const made = await svc().remember({ subject: 'Fresh', text: 'c', type: 'fact', path: 'car/fresh.md' });
    expect(made).toMatchObject({ created: true, matchedBy: null });
  });

  it('browses headers with filters and ranks them by query', async () => {
    await remember('Carpet cleaning', 'CleanPro, 069xxxxxx', {
      aliases: ['rug cleaning'],
      tags: ['home'],
      date: '2026-10-01',
    });
    await remember('Barber', 'Figaro', { date: '2026-11-20' });
    await remember('Washing detergent', 'Ariel powder', { category: 'home', date: '2026-11-21' });
    await svc().markReviewed(['services/carpet-cleaning.md']);

    const all = await svc().browse();
    expect(all.map(n => n.path)).toEqual([
      'home/washing-detergent.md',
      'services/barber.md',
      'services/carpet-cleaning.md',
    ]);
    expect(all[2]).toMatchObject({
      title: 'Carpet cleaning',
      category: 'services',
      aliases: ['rug cleaning'],
      tags: ['home'],
      entryCount: 1,
      updated: '2026-10-01',
      firstLine: 'CleanPro, 069xxxxxx',
      reviewed: true,
    });
    expect(all[0]).toMatchObject({ reviewed: false });

    expect((await svc().browse({ category: 'services' })).map(n => n.title)).toEqual(['Barber', 'Carpet cleaning']);
    expect((await svc().browse({ tag: 'HOME' })).map(n => n.title)).toEqual(['Carpet cleaning']);
    expect((await svc().browse({ updatedSince: '2026-11-01' })).map(n => n.title)).toEqual([
      'Washing detergent',
      'Barber',
    ]);
    expect((await svc().browse({ unreviewedOnly: true })).map(n => n.title)).toEqual(['Washing detergent', 'Barber']);
    expect(await svc().browse({ limit: 1 })).toHaveLength(1);

    const ranked = await svc().browse({ queries: ['CleanPro', 'rug cleaning'], limit: 3 });
    expect(ranked[0]).toMatchObject({ path: 'services/carpet-cleaning.md' });
    expect(ranked[0]!.score).toBeGreaterThan(0);
    expect(ranked[0]!.matchedBy?.length).toBeGreaterThan(0);
    const rankedFiltered = await svc().browse({ queries: ['CleanPro', 'Ariel'], unreviewedOnly: true });
    expect(rankedFiltered.map(n => n.path)).not.toContain('services/carpet-cleaning.md');
  });

  it('falls back to the first body line for the header of an entry-less note', async () => {
    await svc().reindex();
    await mkdir(join(root, user, 'home'), { recursive: true });
    await writeFile(
      join(root, user, 'home/vacuum.md'),
      '---\ntitle: Vacuum\ncategory: home\n---\n\nRoborock S8 works well.\nMore.\n',
    );
    await svc().reindex();
    const [header] = await svc().browse();
    expect(header).toMatchObject({
      entryCount: 0,
      firstLine: 'Roborock S8 works well.',
      updated: null,
      reviewed: true,
    });
  });

  it('queues unreviewed notes with similar existing notes and empties after markReviewed', async () => {
    await remember('Engine oil castrol', 'a', { category: 'car' });
    await svc().markReviewed(['car/engine-oil-castrol.md']);
    await remember('Engine oil mobil', 'b', { category: 'car', aliases: ['motor oil mobil'] });

    const queue = await svc().reviewQueue({ limit: 10, suggestions: 5 });
    expect(queue.remaining).toBe(0);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]!.note.path).toBe('car/engine-oil-mobil.md');
    const { similar } = queue.items[0]!;
    expect(similar.map(n => n.path)).toContain('car/engine-oil-castrol.md');
    expect(similar.map(n => n.path)).not.toContain('car/engine-oil-mobil.md');
    expect(similar[0]!.score).toBeGreaterThan(0);

    expect(await svc().markReviewed(['car/engine-oil-mobil.md'])).toEqual({ reviewed: ['car/engine-oil-mobil.md'] });
    expect((await svc().reviewQueue()).items).toHaveLength(0);
    await expect(svc().markReviewed(['car/missing.md'])).rejects.toThrow(/No note at/);
    await expect(svc().markReviewed([])).rejects.toThrow(/1-50/);
  });

  it('pages the review queue and reports what remains', async () => {
    await remember('Alpha', 'a');
    await remember('Beta', 'b');
    await remember('Gamma', 'c');
    const page = await svc().reviewQueue({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.remaining).toBe(1);
  });

  it('merges a note into another in one commit', async () => {
    await remember('Engine oil castrol', 'castrol 5W-30', { category: 'car', date: '2026-01-01', tags: ['car'] });
    await remember('Engine oil mobil', 'mobil 0W-40', {
      category: 'car',
      date: '2026-06-01',
      type: 'price',
      aliases: ['Motor oil', 'engine oil castrol'],
      tags: ['Car', 'oil'],
    });
    const from = 'car/engine-oil-mobil.md';
    const into = 'car/engine-oil-castrol.md';
    const before = gitLog().length;

    const res = await svc().merge(from, into);
    expect(res).toMatchObject({ into, from, movedEntries: 1, aliases: ['Engine oil mobil', 'Motor oil'] });

    const entries = await svc().entries(into);
    expect(entries.map(e => [e.date, e.type, e.text])).toEqual([
      ['2026-01-01', 'fact', 'castrol 5W-30'],
      ['2026-06-01', 'price', 'mobil 0W-40'],
    ]);
    const file = await readFile(join(root, user, into), 'utf8');
    expect(file).toContain('tags: [car, oil]');
    expect(file).toContain('updated: 2026-06-01');
    expect(file).toContain('reviewed: false');
    await expect(svc().read(from)).rejects.toThrow(/No note at/);
    const rows = await rt.db.query('SELECT 1 FROM notes WHERE user_id = $1 AND path = $2', [user, from]);
    expect(rows.rowCount).toBe(0);
    expect((await svc().browse()).map(n => n.path)).toEqual([into]);
    expect((await svc().search({ queries: ['mobil'] })).hits[0]?.path).toBe(into);

    const log = gitLog();
    expect(log).toHaveLength(before + 1);
    expect(log[0]).toBe(`notes: merge ${from} into ${into}`);

    await expect(svc().merge(into, into)).rejects.toThrow(/itself/);
    await expect(svc().merge('car/none.md', into)).rejects.toThrow(/No note at/);
  });

  it('rejects unsafe paths', async () => {
    await expect(svc().read('../etc/passwd')).rejects.toThrow(/Invalid note path/);
    await expect(svc().read('a/../../b.md')).rejects.toThrow(/Invalid note path/);
    await expect(svc().read('notes.txt')).rejects.toThrow(/Invalid note path/);
    await expect(svc().read('missing/note.md')).rejects.toThrow(/No note at/);
  });

  it('rebuilds the whole index from the files and picks up manual edits', async () => {
    await remember('Carpet cleaning', 'CleanPro');
    // Edited by hand in Obsidian: new id-less line plus a brand-new file.
    const dir = join(root, user);
    const file = join(dir, 'services/carpet-cleaning.md');
    await writeFile(file, (await readFile(file, 'utf8')) + '- 2026-12-01 [verdict] Handwritten verdict\n');
    await mkdir(join(dir, 'home'), { recursive: true });
    await writeFile(join(dir, 'home/vacuum.md'), '---\ntitle: Vacuum\ncategory: home\n---\nRoborock S8 works well.\n');

    const res = await svc().reindex({ full: true });
    expect(res.files).toBe(2);
    expect((await svc().search({ queries: ['handwritten'] })).hits[0]?.path).toBe('services/carpet-cleaning.md');
    expect((await svc().search({ queries: ['roborock'] })).hits[0]?.path).toBe('home/vacuum.md');
    expect((await svc().browse()).map(n => n.path)).toEqual(['home/vacuum.md', 'services/carpet-cleaning.md']);

    // The file was not rewritten by indexing.
    expect(await readFile(file, 'utf8')).toContain('- 2026-12-01 [verdict] Handwritten verdict\n');
  });

  it('keeps users isolated', async () => {
    await remember('Carpet cleaning', 'CleanPro');
    const other = rt.forUser('user-b');
    expect((await other.search({ queries: ['cleanpro'] })).hits).toHaveLength(0);
    expect(await other.browse()).toHaveLength(0);
    await expect(other.read('services/carpet-cleaning.md')).rejects.toThrow(/No note at/);
  });

  it('lists recent entries newest first', async () => {
    await remember('Carpet cleaning', 'old', { date: '2026-01-01' });
    await remember('Engine oil', 'new', { date: '2026-11-01', category: 'car' });
    const recent = await svc().recent(5);
    expect(recent.map(r => r.text)).toEqual(['new', 'old']);
  });

  it('serialises concurrent writes to one note', async () => {
    await remember('Carpet cleaning', 'first');
    await Promise.all(Array.from({ length: 8 }, (_, i) => remember('Carpet cleaning', `entry ${i}`)));
    expect(await svc().entries('services/carpet-cleaning.md')).toHaveLength(9);
  });
});
