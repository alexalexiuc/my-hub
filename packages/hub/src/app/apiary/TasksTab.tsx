'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ApiaryTask, ApiaryHive } from '@my-hub/shared/types';
import { SectionCard } from '@/components/SectionCard';
import { Button, Input, Select } from '@/components';
import { apiFetch } from '@/lib/utils';
import { TaskFormSchema, type TaskFormValues, defaultTaskFormValues, formToTaskBody } from './apiary-form.schema';

type FilterMode = 'pending' | 'completed' | 'all';

export function TasksTab() {
  const [tasks, setTasks] = useState<ApiaryTask[]>([]);
  const [hives, setHives] = useState<ApiaryHive[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('pending');
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues: defaultTaskFormValues,
  });

  const loadData = useCallback(async () => {
    try {
      const completed = filter === 'pending' ? 'false' : filter === 'completed' ? 'true' : undefined;
      const [tasksData, hivesData] = await Promise.all([
        apiFetch<{ tasks: ApiaryTask[] }>('/api/apiary/tasks', { query: { completed } }),
        apiFetch<{ hives: ApiaryHive[] }>('/api/apiary/hives'),
      ]);
      setTasks(tasksData.tasks);
      setHives(hivesData.hives);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd(values: TaskFormValues) {
    await apiFetch('/api/apiary/tasks', { method: 'POST', body: formToTaskBody(values) });
    reset(defaultTaskFormValues);
    setShowForm(false);
    loadData();
  }

  async function handleToggle(taskId: number, completed: boolean) {
    await apiFetch(`/api/apiary/tasks/${taskId}`, { method: 'PATCH', body: { completed: !completed } });
    loadData();
  }

  async function handleDelete(taskId: number) {
    await apiFetch(`/api/apiary/tasks/${taskId}`, { method: 'DELETE' });
    loadData();
  }

  const hiveMap = new Map(hives.map((h) => [h.id, h.name]));
  const now = new Date();

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-xl bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter + add */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['pending', 'completed', 'all'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              filter === mode ? 'bg-amber-900/50 text-amber-300' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Task'}
          </Button>
        </div>
      </div>

      {showForm && (
        <SectionCard title="New Task">
          <form onSubmit={handleSubmit(handleAdd)}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input {...register('title')} className="sm:col-span-3" placeholder="Task title *" autoFocus />
              <Select {...register('hiveId')} options={hives.map((h) => ({ value: h.id, label: h.name }))}>
                <option value="">No hive</option>
              </Select>
              <Input {...register('dueAt')} type="date" placeholder="Due date" />
              <div className="flex justify-end items-end">
                <Button type="submit" size="sm" loading={isSubmitting}>
                  Add
                </Button>
              </div>
            </div>
          </form>
        </SectionCard>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {filter === 'pending'
            ? 'No pending tasks.'
            : filter === 'completed'
              ? 'No completed tasks.'
              : 'No tasks yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const isOverdue = !task.completed && task.dueAt && new Date(task.dueAt) < now;
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isOverdue ? 'border-red-800/50 bg-red-950/20' : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <button
                  onClick={() => handleToggle(task.id, task.completed)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    task.completed
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}
                >
                  {task.completed && '✓'}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {task.hiveId && <span>{hiveMap.get(task.hiveId) ?? `Hive #${task.hiveId}`}</span>}
                    {task.dueAt && (
                      <span className={isOverdue ? 'text-red-400' : ''}>
                        {task.hiveId ? ' · ' : ''}Due: {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-zinc-600 hover:text-red-400 text-xs shrink-0"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
