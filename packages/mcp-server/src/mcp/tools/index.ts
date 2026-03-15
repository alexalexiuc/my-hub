import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools(mcp: McpServer): void {
  mcp.tool('ping', 'Health check tool — returns pong', () => ({
    content: [{ type: 'text' as const, text: 'pong' }],
  }));
}
