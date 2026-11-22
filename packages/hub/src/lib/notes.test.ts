// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyToken } from '@my-hub/shared/auth';
import { NOTES_DELETE_ALL_PURPOSE } from '@my-hub/shared/constants';
import { deleteAllUserNotes } from './notes';

vi.mock('server-only', () => ({}));

const SECRET = 'test-secret';

describe('deleteAllUserNotes', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', SECRET);
    vi.stubEnv('NEXT_PUBLIC_MCP_URL', 'https://mcp.example.test');
    vi.stubEnv('MCP_INTERNAL_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the internal endpoint with a short-lived token for this user', async () => {
    vi.stubEnv('MCP_INTERNAL_URL', 'http://mcp:3001');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deleted: true })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAllUserNotes('user-1')).resolves.toEqual({ deleted: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://mcp:3001/api/notes/delete-all');
    const token = (init.headers as Record<string, string>).authorization!.replace('Bearer ', '');
    expect(await verifyToken(token, SECRET)).toMatchObject({ userId: 'user-1', purpose: NOTES_DELETE_ALL_PURPOSE });
  });

  it('falls back to the public MCP URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deleted: false })));
    vi.stubGlobal('fetch', fetchMock);
    await deleteAllUserNotes('user-1');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://mcp.example.test/api/notes/delete-all');
  });

  it('throws when the mcp-server refuses, so the Hub never reports a partial delete as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(deleteAllUserNotes('user-1')).rejects.toThrow(/401/);
  });

  it('skips the call when no MCP server is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_MCP_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteAllUserNotes('user-1')).resolves.toMatchObject({ deleted: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
