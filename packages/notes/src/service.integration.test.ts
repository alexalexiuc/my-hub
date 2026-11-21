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

  it('matches an existing note through an alias', async () => {
    await remember('Carpet cleaning', 'CleanPro', { aliases: ['covoare'] });
    const res = await remember('Covoare', 'second visit was fine');
    expect(res).toMatchObject({ status: 'saved', created: false, path: 'services/carpet-cleaning.md' });
  });

  it('makes one git commit per write', async () => {
    const a = await remember('Engine oil', '5W-30 Castrol', { category: 'car' });
    if (a.status !== 'saved') throw new Error('expected saved');
    await remember('Engine oil', 'changed at 120000 km', { category: 'car' });
    const log = execFileSync('git', ['log', '--format=%s'], { cwd: join(root, user) })
      .toString()
      .trim()
      .split('\n');
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
    if (r.status !== 'saved') throw new Error('expected saved');
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
    if (r.status !== 'saved') throw new Error('expected saved');
    await svc().addAlias(r.path, 'covoare');
    const again = await svc().addAlias(r.path, 'Covoare');
    expect(again.aliases).toEqual(['covoare']);
    expect((await svc().search({ queries: ['covoare'] })).hits[0]?.path).toBe(r.path);
  });

  it('keeps similar-but-different subjects as separate notes', async () => {
    const a = await remember('Engine oil castrol', 'a', { category: 'car' });
    const b = await remember('Engine oil mobil', 'b', { category: 'car' });
    expect(a).toMatchObject({ created: true });
    expect(b).toMatchObject({ created: true, path: 'car/engine-oil-mobil.md' });
  });

  it('returns candidates instead of guessing when two notes share a name', async () => {
    await remember('Castrol edge', 'a', { category: 'car', aliases: ['motor oil'] });
    await remember('Mobil 1', 'b', { category: 'car', aliases: ['motor oil'] });
    const res = await svc().remember({ subject: 'Motor oil', text: 'c', type: 'fact', category: 'car' });
    expect(res.status).toBe('ambiguous');
    if (res.status === 'ambiguous') {
      expect(res.candidates.map(c => c.path).sort()).toEqual(['car/castrol-edge.md', 'car/mobil-1.md']);
    }

    const forced = await svc().remember({ subject: 'Motor oil', text: 'c', type: 'fact', path: 'car/mobil-1.md' });
    expect(forced).toMatchObject({ status: 'saved', created: false, path: 'car/mobil-1.md' });
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
    expect((await svc().list()).map(n => n.path)).toEqual(['home/vacuum.md', 'services/carpet-cleaning.md']);

    // The file was not rewritten by indexing.
    expect(await readFile(file, 'utf8')).toContain('- 2026-12-01 [verdict] Handwritten verdict\n');
  });

  it('keeps users isolated', async () => {
    await remember('Carpet cleaning', 'CleanPro');
    const other = rt.forUser('user-b');
    expect((await other.search({ queries: ['cleanpro'] })).hits).toHaveLength(0);
    expect(await other.list()).toHaveLength(0);
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
