import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { createApiaryTask, updateApiaryTask, deleteApiaryTask, getApiaryTasks } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const ListTasksSchema = z.object({
  hiveId: z.number().int().positive().optional().describe('Filter tasks by hive ID'),
  yardId: z.number().int().positive().optional().describe('Filter tasks by yard ID'),
  completed: z.boolean().optional().describe('Filter by completion status (true = completed, false = pending)'),
  dueBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter tasks due before this date (YYYY-MM-DD)'),
  limit: z
    .number()
    .int()
    .positive()
    .max(200)
    .default(100)
    .optional()
    .describe('Max entries to return (default: 100, max: 200)'),
});

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).describe('Task description'),
  hiveId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('ID of the hive this task relates to (cannot combine with yardId)'),
  yardId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('ID of the yard this task relates to (cannot combine with hiveId)'),
  dueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Due date (YYYY-MM-DD)'),
});

export const CompleteTaskSchema = z.object({
  taskId: z.number().int().positive().describe('ID of the task to mark as completed'),
});

export const DeleteTaskSchema = z.object({
  taskId: z.number().int().positive().describe('ID of the task to delete'),
});

export const createTaskTool: ToolHandler<typeof CreateTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const dueAt = input.dueAt ? new Date(input.dueAt) : undefined;
  const task = await createApiaryTask(userId, {
    title: input.title,
    ...omitNullish({ hiveId: input.hiveId, yardId: input.yardId, dueAt }),
  });
  return toolResponse(task);
};

export const completeTaskTool: ToolHandler<typeof CompleteTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const task = await updateApiaryTask(userId, input.taskId, { completed: true });
  if (!task) throw new Error(`Task with id ${input.taskId} not found`);
  return toolResponse(task);
};

export const deleteTaskTool: ToolHandler<typeof DeleteTaskSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const deleted = await deleteApiaryTask(userId, input.taskId);
  if (!deleted) throw new Error(`Task with id ${input.taskId} not found`);
  return toolResponse({ deleted: true, taskId: input.taskId });
};

export const listTasksTool: ToolHandler<typeof ListTasksSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const dueBefore = input.dueBefore ? new Date(input.dueBefore) : undefined;
  const tasks = await getApiaryTasks(
    userId,
    omitNullish({
      hiveId: input.hiveId,
      yardId: input.yardId,
      completed: input.completed,
      dueBefore,
      limit: input.limit,
    }),
  );
  return toolResponse({ tasks, count: tasks.length });
};
