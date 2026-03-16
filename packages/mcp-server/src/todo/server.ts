import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTodoTools } from './tools/todos';
import { registerTodoResources } from './resources';

export function createTodoServer(): McpServer {
  const server = new McpServer({
    name: 'todo-mcp-server',
    version: '1.0.0',
  });

  registerTodoTools(server);
  registerTodoResources(server);

  return server;
}
