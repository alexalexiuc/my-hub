import { McpServer } from '@modelcontextprotocol/server';
import { registerNotesTools } from './tools';

export function createNotesServer(): McpServer {
  const server = new McpServer({
    name: 'notes-mcp-server',
    version: '1.0.0',
  });

  registerNotesTools(server);

  return server;
}
