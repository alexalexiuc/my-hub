import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotesServer } from './server';

vi.mock('./runtime.js', () => ({ notesFor: vi.fn() }));

describe('notes MCP server', () => {
  let client: Client;

  afterEach(async () => {
    await client?.close();
  });

  const connect = async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createNotesServer().connect(serverTransport);
    client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(clientTransport);
  };

  it('sends server instructions in the initialize result', async () => {
    await connect();
    const instructions = client.getInstructions();
    expect(instructions).toContain('notes_remember');
    expect(instructions).toContain('notes_search');
    expect(instructions).toMatch(/built-in memory/);
  });

  it('describes Notes as a general notebook and accepts the general entry types', async () => {
    await connect();
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));
    for (const name of ['notes_remember', 'notes_search']) {
      expect(byName[name]?.description).toContain('personal notebook');
      expect(byName[name]?.description).not.toMatch(/THINGS and SERVICES|biographical/);
    }
    const remember = byName.notes_remember!.inputSchema as unknown as {
      properties: { type: { enum: string[] } };
      required?: string[];
    };
    expect(remember.properties.type.enum).toEqual(expect.arrayContaining(['note', 'idea', 'fact']));
    expect(remember.required ?? []).not.toContain('type');
    const edit = byName.notes_edit_entry!.inputSchema as unknown as { properties: { type: { enum: string[] } } };
    expect(edit.properties.type.enum).toEqual(remember.properties.type.enum);
  });
});
