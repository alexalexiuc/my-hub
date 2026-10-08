import { McpServer } from '@modelcontextprotocol/server';
import { registerCaloriesTools } from './tools';
import { registerCaloriesResources } from './resources';

export function createCaloriesServer(): McpServer {
  const server = new McpServer({
    name: 'calories-tracker-mcp-server',
    version: '1.0.0',
  });

  registerCaloriesTools(server);
  registerCaloriesResources(server);

  return server;
}
