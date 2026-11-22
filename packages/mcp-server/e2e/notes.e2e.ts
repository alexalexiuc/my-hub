import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface Hit {
  path: string;
  title: string;
  matchedBy: string[];
  entries: { id: string; type: string; text: string }[];
}
interface Saved {
  status: 'saved';
  path: string;
  created: boolean;
  matchedBy: 'path' | 'name' | null;
  entryId: string;
}
interface Header {
  path: string;
  title: string;
  aliases: string[];
  entryCount: number;
  reviewed: boolean;
}

/**
 * E2e tests for the notes MCP sub-server (staging runs it with EMBEDDINGS_PROVIDER=fake, so only lexical
 * relevance is asserted here; semantic quality is measured by packages/notes-bench with the real model).
 *
 *   notes_remember → notes_search → notes_read → notes_edit_entry → notes_add_alias → notes_browse
 *   → notes_recent → notes_delete_entry, plus the duplicate flow: remember a near name → notes_review_duplicates
 *   → notes_merge → notes_mark_reviewed
 *
 * Every note carries the run id in its subject, so runs cannot collide with each other or with real notes.
 */
describe('notes — remember, search and edit', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  const subject = `E2e carpet cleaning zq${runId}`;
  const created: { path: string; entryId: string }[] = [];

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    return parseToolResult<T>(result);
  }

  /** Deletes every entry of a note; deleting the last one deletes the file. Best effort (cleanup only). */
  async function purgeNote(path: string): Promise<void> {
    const read = await client.callTool({ name: 'notes_read', arguments: { path } });
    if (read.isError) return;
    const { content } = parseToolResult<{ content: string }>(read);
    for (const [, entryId] of content.matchAll(/ \^([a-z0-9]{2,16})\s*$/gm)) {
      await client.callTool({ name: 'notes_delete_entry', arguments: { path, entryId } });
    }
  }

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    client = await createMcpClient(baseUrl, '/notes/mcp', await generateToken());
    // Leftovers of an aborted run (on a persistent stack) would push this run's notes out of the paged lists.
    const { notes } = await call<{ notes: Header[] }>('notes_browse', { category: 'e2e', limit: 200 });
    for (const n of notes) await purgeNote(n.path);
  });

  afterAll(async () => {
    try {
      for (const path of new Set(created.map(e => e.path))) await purgeNote(path);
    } finally {
      await client.close();
    }
  });

  it('exposes the notes tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(
      [
        'notes_add_alias',
        'notes_delete_entry',
        'notes_edit_entry',
        'notes_browse',
        'notes_mark_reviewed',
        'notes_merge',
        'notes_read',
        'notes_recent',
        'notes_remember',
        'notes_review_duplicates',
        'notes_search',
      ].sort(),
    );
  });

  it('notes_remember creates a note, then appends to it for the same subject', async () => {
    const first = await call<Saved>('notes_remember', {
      subject,
      text: `CleanPro-${runId}, 069xxxxxx, picked up from the flat`,
      type: 'contact',
      category: 'e2e',
      aliases: [`rugs zq${runId}`],
    });
    // beforeAll purged the "e2e" category, so this create opens it.
    expect(first).toMatchObject({ status: 'saved', created: true, newCategory: true });
    expect(Array.isArray((first as { existingCategories?: unknown }).existingCategories)).toBe(true);
    expect(first.path).toMatch(/^e2e\/e2e-carpet-cleaning-zq/);
    created.push(first);

    const second = await call<Saved>('notes_remember', {
      subject,
      text: `450 MDL for 3 rugs (${runId})`,
      type: 'price',
    });
    expect(second).toMatchObject({ status: 'saved', created: false, path: first.path });
    created.push(second);
  });

  it('notes_search finds the note by an exact word and by a typo', async () => {
    const exact = await call<{ hits: Hit[]; timings: { totalMs: number } }>('notes_search', {
      queries: [`CleanPro-${runId}`],
    });
    expect(exact.hits[0]?.path).toBe(created[0]!.path);
    expect(exact.hits[0]?.entries.some(e => e.text.includes(`CleanPro-${runId}`))).toBe(true);
    expect(exact.timings.totalMs).toBeGreaterThan(0);

    // The run id alone would match through full-text search, so also require a trigram leg to have matched.
    const typo = await call<{ hits: Hit[] }>('notes_search', { queries: [`cleanpr0-${runId}`, `unrelated words`] });
    const typoHit = typo.hits.find(h => h.path === created[0]!.path);
    expect(typoHit?.matchedBy.some(leg => leg.toLowerCase().includes('trgm'))).toBe(true);
  });

  it('notes_read returns the Markdown file with both entries', async () => {
    const { content } = await call<{ content: string }>('notes_read', { path: created[0]!.path });
    expect(content).toContain(`title: ${subject}`);
    expect(content).toContain(`^${created[0]!.entryId}`);
    expect(content).toContain(`^${created[1]!.entryId}`);
  });

  it('notes_edit_entry fixes one line and notes_add_alias teaches another name', async () => {
    await call('notes_edit_entry', {
      path: created[1]!.path,
      entryId: created[1]!.entryId,
      text: `500 MDL (${runId})`,
    });
    const { content } = await call<{ content: string }>('notes_read', { path: created[0]!.path });
    expect(content).toContain(`500 MDL (${runId}) ^${created[1]!.entryId}`);
    expect(content).not.toContain('450 MDL');

    const { aliases } = await call<{ aliases: string[] }>('notes_add_alias', {
      path: created[0]!.path,
      alias: `химчистка zq${runId}`,
    });
    expect(aliases).toContain(`химчистка zq${runId}`);
  });

  it('notes_browse and notes_recent include the note', async () => {
    const { notes, categories } = await call<{ notes: Header[]; categories: { name: string; notes: number }[] }>(
      'notes_browse',
      { category: 'e2e' },
    );
    expect(notes.find(n => n.path === created[0]!.path)?.entryCount).toBeGreaterThanOrEqual(2);
    expect(categories.find(c => c.name === 'e2e')?.notes).toBeGreaterThanOrEqual(1);
    const ranked = await call<{ notes: Header[] }>('notes_browse', { queries: [subject], category: 'e2e', limit: 5 });
    expect(ranked.notes.map(n => n.path)).toContain(created[0]!.path);
    const { entries } = await call<{ entries: { path: string }[] }>('notes_recent', { limit: 20 });
    expect(entries.some(e => e.path === created[0]!.path)).toBe(true);
  });

  it('a near-duplicate subject is saved apart, then reviewed and merged', async () => {
    const dupSubject = `${subject} extra`;
    const dup = await call<Saved>('notes_remember', {
      subject: dupSubject,
      text: `Second vendor (${runId})`,
      type: 'fact',
      category: 'e2e',
    });
    expect(dup).toMatchObject({ created: true, matchedBy: null });
    expect(dup.path).not.toBe(created[0]!.path);

    const queue = await call<{
      items: { note: Header; similar: Header[] }[];
      remaining: number;
    }>('notes_review_duplicates', { limit: 20 });
    expect(queue.items.find(i => i.note.path === dup.path)?.note.reviewed).toBe(false);

    const merged = await call<{ movedEntries: number; into: string; from: string }>('notes_merge', {
      from: dup.path,
      into: created[0]!.path,
    });
    expect(merged).toMatchObject({ movedEntries: 1, into: created[0]!.path, from: dup.path });
    const { content } = await call<{ content: string }>('notes_read', { path: created[0]!.path });
    expect(content).toContain(`Second vendor (${runId})`);
    expect(content).toContain(dupSubject);
    const gone = await client.callTool({ name: 'notes_read', arguments: { path: dup.path } });
    expect(gone.isError).toBe(true);

    const reviewed = await call<{ reviewed: string[] }>('notes_mark_reviewed', { paths: [created[0]!.path] });
    expect(reviewed.reviewed).toEqual([created[0]!.path]);
    const after = await call<{ notes: Header[] }>('notes_browse', { category: 'e2e', unreviewedOnly: true });
    expect(after.notes.map(n => n.path)).not.toContain(created[0]!.path);
  });

  it('rejects an unknown note path with a tool error', async () => {
    const result = await client.callTool({ name: 'notes_read', arguments: { path: 'e2e/does-not-exist.md' } });
    expect(result.isError).toBe(true);
  });

  it('notes_delete_entry removes a single line', async () => {
    const entry = created.at(-1)!;
    const res = await call<{ noteDeleted: boolean }>('notes_delete_entry', {
      path: entry.path,
      entryId: entry.entryId,
    });
    expect(res.noteDeleted).toBe(false);
    const { content } = await call<{ content: string }>('notes_read', { path: entry.path });
    expect(content).not.toContain(`^${entry.entryId}`);
  });

  it('notes_delete_entry deletes the note with its last entry', async () => {
    const { content } = await call<{ content: string }>('notes_read', { path: created[0]!.path });
    const ids = [...content.matchAll(/ \^([a-z0-9]{2,16})\s*$/gm)].map(m => m[1]!);
    expect(ids.length).toBeGreaterThan(0);
    let last = { noteDeleted: false };
    for (const entryId of ids) {
      last = await call('notes_delete_entry', { path: created[0]!.path, entryId });
    }
    expect(last.noteDeleted).toBe(true);
    const gone = await client.callTool({ name: 'notes_read', arguments: { path: created[0]!.path } });
    expect(gone.isError).toBe(true);
  });
});
