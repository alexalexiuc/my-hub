import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getOpenTodos } from '@my-hub/shared/services';

function resourceResponse(payload: unknown) {
  return {
    contents: [
      {
        uri: '',
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerTodoResources(server: McpServer): void {
  /**
   * todo://open
   * All unfinished todo items for the authenticated user.
   */
  server.registerResource(
    'todo-open',
    'todo://open',
    {
      description: 'All unfinished (open) todo items for the current user.',
      mimeType: 'application/json',
    },
    async (_uri, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const items = await getOpenTodos(userId);
      return resourceResponse({ openTodos: items, count: items.length });
    },
  );
}
