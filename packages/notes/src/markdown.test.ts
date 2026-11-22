import { describe, expect, it } from 'vitest';
import {
  appendEntry,
  bodyText,
  createNoteText,
  listEntries,
  newEntryId,
  oneLine,
  parseNote,
  readFrontmatter,
  removeEntry,
  replaceEntry,
  serializeNote,
  setFrontmatterKey,
  setFrontmatterList,
} from './markdown';

const SAMPLE = `---
title: Carpet cleaning
category: services
tags: [home, cleaning]
aliases: [rug cleaning, covoare, "curățare covoare", химчистка ковров]
updated: 2026-11-21
custom_key: keep me
---
Short description of the vendor search.
<!-- a comment -->

- 2026-11-21 [contact] CleanPro, 069xxxxxx, picked up from the flat ^k3f9
- 2026-11-21 [price] 450 MDL for 3 rugs #cheap ^p2a1
- 2026-11-28 [verdict] Good result, smell gone, would use again ^v8c4
`;

describe('markdown parser', () => {
  it('round-trips an untouched file exactly', () => {
    expect(serializeNote(parseNote(SAMPLE))).toBe(SAMPLE);
  });

  it.each([
    ['CRLF line endings', SAMPLE.replace(/\n/g, '\r\n')],
    ['no trailing newline', SAMPLE.trimEnd()],
    ['no frontmatter', '- 2026-01-01 [fact] plain ^ab12\n'],
    ['empty file', ''],
    ['odd whitespace and unknown bullets', '---\ntitle: X\n---\n\n\n- not an entry\n  - 2026-01-01 [fact] indented\n'],
  ])('round-trips %s', (_name, text) => {
    expect(serializeNote(parseNote(text))).toBe(text);
  });

  it('parses frontmatter, including quoted and unicode aliases', () => {
    const fm = readFrontmatter(parseNote(SAMPLE), { title: 'x', category: 'y' });
    expect(fm).toEqual({
      title: 'Carpet cleaning',
      category: 'services',
      tags: ['home', 'cleaning'],
      aliases: ['rug cleaning', 'covoare', 'curățare covoare', 'химчистка ковров'],
      updated: '2026-11-21',
      reviewed: true,
    });
  });

  it('parses YAML block lists', () => {
    const note = parseNote('---\ntitle: T\naliases:\n  - one\n  - "two, three"\n---\n');
    expect(readFrontmatter(note, { title: '', category: '' }).aliases).toEqual(['one', 'two, three']);
  });

  it('parses entries with ids, tags and types', () => {
    const entries = listEntries(parseNote(SAMPLE));
    expect(entries.map(e => [e.key, e.date, e.type])).toEqual([
      ['k3f9', '2026-11-21', 'contact'],
      ['p2a1', '2026-11-21', 'price'],
      ['v8c4', '2026-11-28', 'verdict'],
    ]);
    expect(entries[1]!.tags).toEqual(['cheap']);
    expect(entries[1]!.text).toBe('450 MDL for 3 rugs #cheap');
  });

  it('keeps description text out of entries and returns it as body text', () => {
    expect(bodyText(parseNote(SAMPLE))).toBe('Short description of the vendor search.\n<!-- a comment -->');
  });

  it('gives id-less hand-written lines stable distinct keys', () => {
    const note = parseNote('- 2026-01-01 [fact] same\n- 2026-01-01 [fact] same\n');
    const [a, b] = listEntries(note);
    expect(a!.id).toBeNull();
    expect(a!.key).not.toBe(b!.key);
    expect(listEntries(parseNote('- 2026-01-01 [fact] same\n- 2026-01-01 [fact] same\n')).map(e => e.key)).toEqual([
      a!.key,
      b!.key,
    ]);
  });

  it('appends one entry line and changes nothing else', () => {
    const note = parseNote(SAMPLE);
    const id = appendEntry(note, { date: '2026-12-01', type: 'fact', text: 'Opens at 9\nsharp' });
    const out = serializeNote(note);
    expect(out).toBe(`${SAMPLE}- 2026-12-01 [fact] Opens at 9 sharp ^${id}\n`);
    expect(id).toMatch(/^[a-z0-9]{4}$/);
  });

  it('edits and removes a single entry by id', () => {
    const note = parseNote(SAMPLE);
    expect(replaceEntry(note, 'p2a1', { text: '500 MDL for 3 rugs' })).toBe(true);
    expect(removeEntry(note, 'k3f9')).toBe(true);
    expect(removeEntry(note, 'nope')).toBe(false);
    const out = serializeNote(note);
    expect(out).toContain('- 2026-11-21 [price] 500 MDL for 3 rugs ^p2a1');
    expect(out).not.toContain('k3f9');
    expect(out).toContain('custom_key: keep me');
    expect(out).toContain('<!-- a comment -->');
  });

  it('assigns an id when editing an id-less line', () => {
    const note = parseNote('- 2026-01-01 [fact] old\n');
    const [e] = listEntries(note);
    replaceEntry(note, e!.key, { text: 'new' });
    expect(serializeNote(note)).toMatch(/^- 2026-01-01 \[fact\] new \^[a-z0-9]{4}\n$/);
  });

  it('updates frontmatter keys in place, preserving unknown keys', () => {
    const note = parseNote(SAMPLE);
    setFrontmatterKey(note, 'updated', '2027-01-01');
    setFrontmatterList(note, 'aliases', ['a', 'b, c']);
    const out = serializeNote(note);
    expect(out).toContain('updated: 2027-01-01\n');
    expect(out).toContain('aliases: [a, "b, c"]\n');
    expect(out).toContain('custom_key: keep me');
    expect(out.split('\n').filter(l => l.startsWith('aliases:'))).toHaveLength(1);
  });

  it('generates ids that avoid collisions', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) taken.add(newEntryId(taken));
    expect(taken.size).toBe(200);
  });

  it('treats a note as reviewed unless the frontmatter says `reviewed: false`', () => {
    const reviewedOf = (line: string) =>
      readFrontmatter(parseNote(['---', 'title: T', ...(line ? [line] : []), '---', ''].join('\n')), {
        title: 'x',
        category: 'y',
      }).reviewed;
    expect(reviewedOf('')).toBe(true);
    expect(reviewedOf('reviewed: true')).toBe(true);
    expect(reviewedOf('reviewed: yes')).toBe(true);
    expect(reviewedOf('reviewed: false')).toBe(false);
    expect(readFrontmatter(parseNote(SAMPLE), { title: 'x', category: 'y' }).reviewed).toBe(true);
  });

  it('createNoteText writes `reviewed: false` after `updated` only when asked', () => {
    const base = { title: 'Engine oil', category: 'car', tags: [], aliases: [], updated: '2026-11-21' };
    const unreviewed = createNoteText({ ...base, reviewed: false });
    expect(unreviewed).toContain('updated: 2026-11-21\nreviewed: false\n---');
    expect(readFrontmatter(parseNote(unreviewed), { title: 'x', category: 'y' }).reviewed).toBe(false);
    expect(createNoteText(base)).not.toContain('reviewed');
    expect(createNoteText({ ...base, reviewed: true })).not.toContain('reviewed');
  });

  it('edits the right one of two identical id-less lines', () => {
    const note = parseNote('- 2026-01-01 [fact] same\n- 2026-01-01 [fact] same\n');
    const [, second] = listEntries(note);
    expect(second!.index).toBe(1);
    expect(replaceEntry(note, second!.key, { text: 'changed' })).toBe(true);
    expect(serializeNote(note)).toMatch(/^- 2026-01-01 \[fact\] same\n- 2026-01-01 \[fact\] changed \^[a-z0-9]{4}\n$/);

    const other = parseNote('- 2026-01-01 [fact] same\n- 2026-01-01 [fact] same\nend\n');
    expect(removeEntry(other, listEntries(other)[1]!.key)).toBe(true);
    expect(serializeNote(other)).toBe('- 2026-01-01 [fact] same\nend\n');
  });

  it('round-trips quotes, backslashes and commas in frontmatter values', () => {
    const tricky = ['Restaurant "La Placinte"', 'C:\\path\\x', 'a, b', "it's", '[x]'];
    const note = parseNote(
      createNoteText({ title: tricky[0]!, category: 'food', tags: tricky, aliases: tricky, updated: '2026-01-01' }),
    );
    const fm = readFrontmatter(note, { title: 'x', category: 'y' });
    expect(fm.title).toBe(tricky[0]);
    expect(fm.tags).toEqual(tricky);
    expect(fm.aliases).toEqual(tricky);

    setFrontmatterList(note, 'aliases', fm.aliases);
    expect(readFrontmatter(parseNote(serializeNote(note)), { title: 'x', category: 'y' }).aliases).toEqual(tricky);
  });

  it("reads hand-written YAML single-quoted values ('' is a quote)", () => {
    const note = parseNote("---\ntitle: 'Bob''s shop'\naliases: ['it''s', \"x\"]\n---\n");
    const fm = readFrontmatter(note, { title: 'x', category: 'y' });
    expect(fm.title).toBe("Bob's shop");
    expect(fm.aliases).toEqual(["it's", 'x']);
  });

  it('never writes a raw newline into the frontmatter', () => {
    const text = createNoteText({
      title: 'Acme\n---',
      category: 'misc',
      tags: ['a\nb'],
      aliases: [],
      updated: '2026-01-01',
      reviewed: false,
    });
    const fm = readFrontmatter(parseNote(text), { title: 'x', category: 'y' });
    expect(fm).toMatchObject({ title: 'Acme\n---', tags: ['a\nb'], reviewed: false, updated: '2026-01-01' });
    expect(oneLine('  Acme\n---\t x ')).toBe('Acme --- x');
  });
});
