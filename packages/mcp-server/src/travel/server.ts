import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTravelTools } from './tools/index';
import { registerTravelResources } from './resources/index';

export function createTravelServer(): McpServer {
  const server = new McpServer({
    name: 'travel-mcp-server',
    version: '1.0.0',
  });

  registerTravelTools(server);
  registerTravelResources(server);

  return server;
}
