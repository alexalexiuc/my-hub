import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getOpenTodosResource } from './open';

const todoOpenResource = defineResource({
  name: 'todo-open',
  uri: 'todo://open',
  description: 'All unfinished (open) todo items for the current user.',
  mimeType: 'application/json',
  callback: getOpenTodosResource,
});

const todoResources = [todoOpenResource];

export function registerTodoResources(server: McpServer): void {
  for (const resource of todoResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      withUserIdCheckResource(resource.callback),
    );
  }
}
