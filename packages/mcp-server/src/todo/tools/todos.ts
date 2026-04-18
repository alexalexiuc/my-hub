import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addTodo, markTodoDone, getTodos } from '@my-hub/shared/services';

const AddTodoSchema = z.object({
  title: z.string().trim().min(1).describe('The todo item text'),
});

const MarkDoneSchema = z.object({
  id: z.number().int().positive().describe('The id of the todo item to mark as done'),
});

function toolResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

export function registerTodoTools(server: McpServer) {
  server.registerTool(
    'todo_add',
    {
      description: 'Add a new todo item',
      inputSchema: AddTodoSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: z.infer<typeof AddTodoSchema>, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const todo = await addTodo(userId, input.title);
      return toolResponse(todo);
    },
  );

  server.registerTool(
    'todo_mark_done',
    {
      description: 'Mark a todo item as done by its id',
      inputSchema: MarkDoneSchema.shape,
      annotations: { idempotentHint: true, destructiveHint: false },
    },
    async (input: z.infer<typeof MarkDoneSchema>, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const todo = await markTodoDone(userId, input.id);
      if (!todo) throw new Error(`Todo with id ${input.id} not found`);
      return toolResponse(todo);
    },
  );

  server.registerTool(
    'todo_list',
    {
      description: 'List all todo items (both open and done)',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_input, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const items = await getTodos(userId);
      return toolResponse(items);
    },
  );
}
