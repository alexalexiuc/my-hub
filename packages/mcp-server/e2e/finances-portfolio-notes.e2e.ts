import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface Note {
  id: number;
  date: string;
  kind: string;
  title: string | null;
  body: string;
}

/** E2e tests for the portfolio journal tools (save / search / surface on the portfolio view / delete). */
describe('finances — portfolio notes', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  const marker = `e2e-note-${runId}`;
  const noteIds: number[] = [];

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    client = await createMcpClient(baseUrl, '/finances/mcp', await generateToken());

    const existing = parseToolResult<{ exists: boolean }>(
      await client.callTool({ name: 'finances_get_portfolio', arguments: { recentSuppliesLimit: 0 } }),
    );
    if (!existing.exists) {
      await client.callTool({ name: 'finances_update_portfolio', arguments: { settings: {} } });
    }
  });

  afterAll(async () => {
    for (const noteId of noteIds) {
      try {
        await client.callTool({ name: 'finances_delete_portfolio_note', arguments: { noteId } });
      } catch {
        // already deleted
      }
    }
    await client.close();
  });

  it('saves a lesson note', async () => {
    const result = await client.callTool({
      name: 'finances_save_portfolio_note',
      arguments: {
        date: '2099-03-02',
        kind: 'lesson',
        title: `Bought the dip early ${marker}`,
        body: `Bought before the scheduled date; waiting a day would have been cheaper. ${marker}`,
      },
    });
    const data = parseToolResult<{ saved: string; note: Note }>(result);
    expect(data.saved).toBe('created');
    expect(data.note.kind).toBe('lesson');
    noteIds.push(data.note.id);
  });

  it('finds the note by text and kind, and not under another kind', async () => {
    const found = parseToolResult<{ count: number; notes: Note[] }>(
      await client.callTool({
        name: 'finances_get_portfolio_notes',
        arguments: { query: marker, kind: 'lesson' },
      }),
    );
    expect(found.notes.map(n => n.id)).toEqual(noteIds);

    const other = parseToolResult<{ count: number }>(
      await client.callTool({ name: 'finances_get_portfolio_notes', arguments: { query: marker, kind: 'idea' } }),
    );
    expect(other.count).toBe(0);
  });

  it('edits the note and clears its title', async () => {
    const result = await client.callTool({
      name: 'finances_save_portfolio_note',
      arguments: { noteId: noteIds[0], title: null, body: `Edited ${marker}` },
    });
    const data = parseToolResult<{ saved: string; note: Note }>(result);
    expect(data.saved).toBe('updated');
    expect(data.note.title).toBeNull();
    expect(data.note.body).toBe(`Edited ${marker}`);
    expect(data.note.date).toBe('2099-03-02');
  });

  it('surfaces recent notes on finances_get_portfolio', async () => {
    const portfolio = parseToolResult<{ recentNotes: Note[] }>(
      await client.callTool({
        name: 'finances_get_portfolio',
        arguments: { recentSuppliesLimit: 0, recentNotesLimit: 5 },
      }),
    );
    // 2099 sorts newest, so the note is first.
    expect(portfolio.recentNotes[0]?.id).toBe(noteIds[0]);
  });

  it('deletes the note', async () => {
    const data = parseToolResult<{ deleted: boolean }>(
      await client.callTool({ name: 'finances_delete_portfolio_note', arguments: { noteId: noteIds[0] } }),
    );
    expect(data.deleted).toBe(true);
    noteIds.length = 0;

    const after = parseToolResult<{ count: number }>(
      await client.callTool({ name: 'finances_get_portfolio_notes', arguments: { query: marker } }),
    );
    expect(after.count).toBe(0);
  });
});
