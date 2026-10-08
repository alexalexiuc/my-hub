import { McpServer } from '@modelcontextprotocol/server';
import { registerFinancesTools } from './tools/';
import { registerFinancesResources } from './resources/';

export function createFinancesServer(): McpServer {
  const server = new McpServer({
    name: 'finances-mcp-server',
    version: '1.0.0',
  });

  registerFinancesTools(server);
  registerFinancesResources(server);

  return server;
}
