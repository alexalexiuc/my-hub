import { McpServer } from '@modelcontextprotocol/server';
import { registerVacationTools } from './tools';

export function createVacationServer(): McpServer {
  const server = new McpServer({
    name: 'vacation-planner-mcp-server',
    version: '1.0.0',
  });

  registerVacationTools(server);

  return server;
}
