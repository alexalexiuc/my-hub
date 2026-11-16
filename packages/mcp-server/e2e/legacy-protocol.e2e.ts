import { describe, it, expect, beforeAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';

/** 2025-era clients (claude.ai artifact pages) must still be served on every domain endpoint. */
describe('legacy 2025-11-25 clients', () => {
  let token: string;

  beforeAll(async () => {
    token = await generateToken();
  });

  const post = (body: unknown) =>
    fetch(new URL('/api/calories/mcp', getE2eEnv().baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  it('answers initialize and tools/list without a session', async () => {
    const init = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'e2e-legacy', version: '1.0.0' } },
    });
    expect(init.status).toBe(200);
    expect(await init.text()).toContain('serverInfo');

    const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(list.status).toBe(200);
    expect(await list.text()).toContain('calories_');
  });
});
