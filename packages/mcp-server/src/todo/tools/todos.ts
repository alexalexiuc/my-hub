import { z } from 'zod';
import { addTodo, getTodos, markTodoDone } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { ToolHandler } from '../../shared/types';

export const AddTodoSchema = z.object({
  title: z.string().trim().min(1).describe('The todo item text'),
});

export const MarkDoneSchema = z.object({
  id: z.number().int().positive().describe('The id of the todo item to mark as done'),
});

export const ListTodosSchema = z.object({});

export const addTodoTool: ToolHandler<typeof AddTodoSchema.shape> = async (input, context) => {
  const { userId } = context;
  const todo = await addTodo(userId, input.title);
  return toolResponse(todo);
};

export const markDoneTool: ToolHandler<typeof MarkDoneSchema.shape> = async (input, context) => {
  const { userId } = context;
  const todo = await markTodoDone(userId, input.id);
  if (!todo) throw new Error(`Todo with id ${input.id} not found`);
  return toolResponse(todo);
};

export const listTodosTool: ToolHandler<typeof ListTodosSchema.shape> = async (_input, context) => {
  const { userId } = context;
  const items = await getTodos(userId);
  return toolResponse(items);
};
