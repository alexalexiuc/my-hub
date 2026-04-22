import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getOpenTodos } from '@my-hub/shared/services';
import { defineResource, withUserIdCheckResource } from '../../shared/toolsUtils';
import { resourceResponse } from '../../shared/resourcesUtils';

const todoOpenResource = defineResource({
  name: 'todo-open',
  uri: 'todo://open',
  description: 'All unfinished (open) todo items for the current user.',
  mimeType: 'application/json',
  callback: async (uri, context) => {
    const { userId } = context;
    const items = await getOpenTodos(userId);
    return resourceResponse(uri, { openTodos: items, count: items.length });
  },
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
