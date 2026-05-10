import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type McpClient = Client;

/**
 * Creates and connects an MCP client to the given endpoint.
 * The Bearer token is attached to every request via requestInit headers.
 */
export async function createMcpClient(baseUrl: string, path: string, token: string): Promise<McpClient> {
  const pathWithApiPrefix = path.startsWith('/api/') ? path : `/api${path}`;
  const url = new URL(pathWithApiPrefix, baseUrl);
  console.log(`Connecting MCP client to ${url} with token ${token.slice(0, 4)}...`);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const client = new Client({ name: 'e2e-test-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

/**
 * Parses the JSON text from the first content item of an MCP tool result.
 * All tools in this project return `{ content: [{ type: 'text', text: JSON }] }`.
 */
type McpContentItem = { type: string; text?: string };

export function parseToolResult<T = unknown>(result: Awaited<ReturnType<Client['callTool']>>): T {
  const { content, isError } = result as { content: McpContentItem[]; isError?: boolean };
  const item = content[0];
  if (!item || item.type !== 'text' || item.text === undefined) {
    throw new Error(`Unexpected MCP content type: ${item?.type ?? 'none'}`);
  }

  if (isError) {
    throw new Error(`MCP tool returned error: ${item.text}`);
  }

  try {
    return JSON.parse(item.text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse MCP tool JSON response: ${message}. Raw text: ${item.text}`);
  }
}
