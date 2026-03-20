import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createApiaryTask, updateApiaryTask, deleteApiaryTask } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const CreateTaskSchema = z.object({
  title: z.string().min(1).describe('Task description'),
  hive_id: z.number().int().positive().optional().describe('ID of the hive this task relates to'),
  due_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Due date (YYYY-MM-DD)'),
});

export const CompleteTaskSchema = z.object({
  task_id: z.number().int().positive().describe('ID of the task to mark as completed'),
});

export const DeleteTaskSchema = z.object({
  task_id: z.number().int().positive().describe('ID of the task to delete'),
});

export const createTaskTool: ToolCallback<typeof CreateTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const dueAt = input.due_at ? new Date(input.due_at) : undefined;
  const task = await createApiaryTask(userId, { title: input.title, ...omitNullish({ hiveId: input.hive_id, dueAt }) });
  return toolResponse(task);
};

export const completeTaskTool: ToolCallback<typeof CompleteTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const task = await updateApiaryTask(userId, input.task_id, { completed: true });
  if (!task) throw new Error(`Task with id ${input.task_id} not found`);
  return toolResponse(task);
};

export const deleteTaskTool: ToolCallback<typeof DeleteTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const deleted = await deleteApiaryTask(userId, input.task_id);
  if (!deleted) throw new Error(`Task with id ${input.task_id} not found`);
  return toolResponse({ deleted: true, task_id: input.task_id });
};
