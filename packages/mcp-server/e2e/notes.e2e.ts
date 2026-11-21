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
  entryId: string;
}

/**
 * E2e tests for the notes MCP sub-server (staging runs it with EMBEDDINGS_PROVIDER=fake, so only lexical
 * relevance is asserted here; semantic quality is measured by packages/notes-bench with the real model).
 *
 *   notes_remember → notes_search → notes_read → notes_edit_entry → notes_add_alias → notes_list
 *   → notes_recent → notes_delete_entry
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

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    client = await createMcpClient(baseUrl, '/notes/mcp', await generateToken());
  });

  afterAll(async () => {
    try {
      for (const e of created) {
        await client.callTool({ name: 'notes_delete_entry', arguments: { path: e.path, entryId: e.entryId } });
      }
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
        'notes_list',
        'notes_read',
        'notes_recent',
        'notes_remember',
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
    expect(first).toMatchObject({ status: 'saved', created: true });
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

    const typo = await call<{ hits: Hit[] }>('notes_search', { queries: [`cleanpr0-${runId}`, `unrelated words`] });
    expect(typo.hits.map(h => h.path)).toContain(created[0]!.path);
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

  it('notes_list and notes_recent include the note', async () => {
    const { notes } = await call<{ notes: { path: string; entryCount: number }[] }>('notes_list', { category: 'e2e' });
    expect(notes.find(n => n.path === created[0]!.path)?.entryCount).toBeGreaterThanOrEqual(2);
    const { entries } = await call<{ entries: { path: string }[] }>('notes_recent', { limit: 20 });
    expect(entries.some(e => e.path === created[0]!.path)).toBe(true);
  });

  it('rejects an unknown note path with a tool error', async () => {
    const result = await client.callTool({ name: 'notes_read', arguments: { path: 'e2e/does-not-exist.md' } });
    expect(result.isError).toBe(true);
  });

  it('notes_delete_entry removes a single line', async () => {
    const entry = created.pop()!;
    await call('notes_delete_entry', { path: entry.path, entryId: entry.entryId });
    const { content } = await call<{ content: string }>('notes_read', { path: entry.path });
    expect(content).not.toContain(`^${entry.entryId}`);
  });
});
