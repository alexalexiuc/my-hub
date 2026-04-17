import { z } from 'zod';
import { ApiaryLogTypes } from '@my-hub/shared/schemas';

export const HiveFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  yardId: z.string(),
  queenStatus: z.string(),
  boxes: z.string(),
  notes: z.string(),
});

export type HiveFormValues = z.infer<typeof HiveFormSchema>;

export const defaultHiveFormValues: HiveFormValues = {
  name: '',
  yardId: '',
  queenStatus: '',
  boxes: '',
  notes: '',
};

export function formToHiveBody(values: HiveFormValues): Record<string, unknown> {
  return {
    name: values.name.trim(),
    ...(values.yardId ? { yardId: Number(values.yardId) } : {}),
    ...(values.queenStatus ? { queenStatus: values.queenStatus } : {}),
    ...(values.boxes ? { boxes: Number(values.boxes) } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
  };
}

export const LogFormSchema = z.object({
  type: z.enum(ApiaryLogTypes),
  hiveId: z.string(),
  notes: z.string(),
  loggedAt: z.string(),
});

export type LogFormValues = z.infer<typeof LogFormSchema>;

export const defaultLogFormValues: LogFormValues = {
  type: 'inspection',
  hiveId: '',
  notes: '',
  loggedAt: '',
};

export function formToLogBody(values: LogFormValues): Record<string, unknown> {
  return {
    type: values.type,
    ...(values.hiveId ? { hiveId: Number(values.hiveId) } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    ...(values.loggedAt ? { loggedAt: values.loggedAt } : {}),
  };
}

export const TaskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  hiveId: z.string(),
  dueAt: z.string(),
});

export type TaskFormValues = z.infer<typeof TaskFormSchema>;

export const defaultTaskFormValues: TaskFormValues = {
  title: '',
  hiveId: '',
  dueAt: '',
};

export function formToTaskBody(values: TaskFormValues): Record<string, unknown> {
  return {
    title: values.title.trim(),
    ...(values.hiveId ? { hiveId: Number(values.hiveId) } : {}),
    ...(values.dueAt ? { dueAt: values.dueAt } : {}),
  };
}
