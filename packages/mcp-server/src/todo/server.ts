import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTodoResources } from './resources/';
import { registerTodoTools } from './tools/';

export function createTodoServer(): McpServer {
  const server = new McpServer({
    name: 'todo-mcp-server',
    version: '1.0.0',
  });

  registerTodoTools(server);
  registerTodoResources(server);

  return server;
}
