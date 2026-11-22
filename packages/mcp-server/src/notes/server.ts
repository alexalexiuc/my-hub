import { McpServer } from '@modelcontextprotocol/server';
import { NOTES_SERVER_INSTRUCTIONS } from './instructions';
import { registerNotesTools } from './tools';

export function createNotesServer(): McpServer {
  const server = new McpServer(
    {
      name: 'notes-mcp-server',
      version: '1.0.0',
    },
    { instructions: NOTES_SERVER_INSTRUCTIONS },
  );

  registerNotesTools(server);

  return server;
}
