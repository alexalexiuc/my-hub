import { signToken } from '@my-hub/shared/auth';
import { NOTES_DELETE_ALL_PATH, NOTES_DELETE_ALL_PURPOSE } from '@my-hub/shared/constants';
import { hubEnvConfig } from '@/config/env';

export type DeleteAllNotesResult = { deleted: boolean; reason?: string };

/**
 * Deletes the user's notes (Markdown files and index rows). They live only on the mcp-server,
 * so this calls its internal endpoint with a one-minute token. Throws when the server cannot be reached or
 * refuses, so "Delete all my data" never reports success while notes survive. Skipped only when `MCP_INTERNAL_URL`
 * is not set (the UI sandbox).
 */
export async function deleteAllUserNotes(userId: string): Promise<DeleteAllNotesResult> {
  const base = hubEnvConfig.MCP_INTERNAL_URL;
  if (!base) return { deleted: false, reason: 'no MCP server configured' };

  const token = await signToken({ userId, purpose: NOTES_DELETE_ALL_PURPOSE }, hubEnvConfig.NEXTAUTH_SECRET, 1);
  // Server to server, so plain fetch: apiFetch is the browser client for the Hub's own API (it toasts).
  const res = await fetch(new URL(NOTES_DELETE_ALL_PATH, base), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Deleting notes failed: mcp-server answered ${res.status}`);
  return (await res.json()) as DeleteAllNotesResult;
}
