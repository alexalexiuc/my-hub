import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerApiaryTools } from './tools/';
import { registerApiaryResources } from './resources/';

export function createApiaryServer(): McpServer {
  const server = new McpServer({
    name: 'apiary-mcp-server',
    version: '1.0.0',
  });

  registerApiaryTools(server);
  registerApiaryResources(server);

  return server;
}
