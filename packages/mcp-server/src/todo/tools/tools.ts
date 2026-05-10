import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, wrapToolHandler } from '../../shared/toolsUtils';
import { AddTodoSchema, addTodoTool, ListTodosSchema, listTodosTool, MarkDoneSchema, markDoneTool } from './todos';

const addTodoDefinition = defineTool({
  name: 'todo_add',
  description: 'Add a new todo item',
  inputSchema: AddTodoSchema.shape,
  annotations: { idempotentHint: false, destructiveHint: false },
  callback: addTodoTool,
});

const markDoneDefinition = defineTool({
  name: 'todo_mark_done',
  description: 'Mark a todo item as done by its id',
  inputSchema: MarkDoneSchema.shape,
  annotations: { idempotentHint: true, destructiveHint: false },
  callback: markDoneTool,
});

const listTodosDefinition = defineTool({
  name: 'todo_list',
  description: 'List all todo items (both open and done)',
  inputSchema: ListTodosSchema.shape,
  annotations: { readOnlyHint: true },
  callback: listTodosTool,
});

const todoTools = [addTodoDefinition, markDoneDefinition, listTodosDefinition];

export function registerTodoTools(server: McpServer): void {
  for (const tool of todoTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      wrapToolHandler(tool.callback),
    );
  }
}
