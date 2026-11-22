import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { SearchLeg } from '@my-hub/notes';
import type { Args, Harness } from './lib';
import { benchEnv } from './config/env';

/** The server only speaks MCP 2026-07-28 (stateless), so the client pins it. */
const MCP_PROTOCOL_VERSION = '2026-07-28';

export interface SearchOutcome {
  paths: string[];
  wallMs: number;
  /** Server-side timings reported by notes_search (absent for older servers). */
  server?: { embedMs: number; dbMs: number; totalMs: number };
}

export interface SearchClient {
  readonly label: string;
  search(
    queries: string[],
    opts?: { legs?: Partial<Record<SearchLeg, boolean>>; limit?: number },
  ): Promise<SearchOutcome>;
  close(): Promise<void>;
}

export function directClient(h: Harness): SearchClient {
  return {
    label: 'direct',
    async search(queries, opts) {
      const t = performance.now();
      const res = await h.svc.search({ queries, limit: opts?.limit ?? 5, legs: opts?.legs });
      return { paths: res.hits.map(x => x.path), wallMs: performance.now() - t, server: res.timings };
    },
    close: async () => undefined,
  };
}

async function accessToken(target: string, args: Args): Promise<string> {
  const direct = args.flags.get('token') || benchEnv.TOKEN;
  if (direct) return direct;
  const clientId = args.flags.get('client-id') || benchEnv.CLIENT_ID;
  const clientSecret = args.flags.get('client-secret') || benchEnv.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('--target needs --token, or --client-id and --client-secret (or NOTES_BENCH_* env vars).');
  }
  const res = await fetch(new URL('/api/token', target), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`POST /api/token failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function connect(target: string, args: Args): Promise<Client> {
  const token = await accessToken(target, args);
  const transport = new StreamableHTTPClientTransport(new URL('/api/notes/mcp', target), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client(
    { name: 'notes-bench', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: MCP_PROTOCOL_VERSION } } },
  );
  await client.connect(transport);
  return client;
}

export async function callJson<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text?: string }[];
    isError?: boolean;
  };
  const text = result.content[0]?.text ?? '';
  if (result.isError) throw new Error(`${name} failed: ${text}`);
  return JSON.parse(text) as T;
}

/** Searches through the real MCP HTTP endpoint (JSON-RPC), so wall time includes transport, auth and TLS. */
export async function mcpClient(target: string, args: Args): Promise<SearchClient & { raw: Client }> {
  const raw = await connect(target, args);
  return {
    raw,
    label: `mcp ${target}`,
    async search(queries, opts) {
      const t = performance.now();
      const res = await callJson<{ hits: { path: string }[]; timings?: SearchOutcome['server'] }>(raw, 'notes_search', {
        queries,
        limit: opts?.limit ?? 5,
      });
      return { paths: res.hits.map(x => x.path), wallMs: performance.now() - t, server: res.timings };
    },
    close: () => raw.close(),
  };
}
