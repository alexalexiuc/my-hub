import { describe, it, expect } from 'vitest';
import { getBaseUrl } from './helpers/env.js';

describe('health endpoint', () => {
  it('returns 200 with status ok', async () => {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  it('rejects unknown routes with 404', async () => {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/this-does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('rejects mcp endpoint without auth with 401', async () => {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/mcp/calories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    expect(res.status).toBe(401);
  });
});
