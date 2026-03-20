'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ApiaryTask, ApiaryHive } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';
import Button from '@/components/button';

type FilterMode = 'pending' | 'completed' | 'all';

export default function TasksTab() {
  const [tasks, setTasks] = useState<ApiaryTask[]>([]);
  const [hives, setHives] = useState<ApiaryHive[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('pending');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formHiveId, setFormHiveId] = useState('');
  const [formDueAt, setFormDueAt] = useState('');

  const loadData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter === 'pending') params.set('completed', 'false');
    if (filter === 'completed') params.set('completed', 'true');

    const [tasksRes, hivesRes] = await Promise.all([
      fetch(`/api/apiary/tasks?${params.toString()}`),
      fetch('/api/apiary/hives'),
    ]);

    if (tasksRes.ok) {
      const data = (await tasksRes.json()) as { tasks: ApiaryTask[] };
      setTasks(data.tasks);
    }
    if (hivesRes.ok) {
      const data = (await hivesRes.json()) as { hives: ApiaryHive[] };
      setHives(data.hives);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd() {
    if (!formTitle.trim()) return;
    const body: Record<string, unknown> = { title: formTitle.trim() };
    if (formHiveId) body.hive_id = Number(formHiveId);
    if (formDueAt) body.due_at = formDueAt;

    await fetch('/api/apiary/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setFormTitle('');
    setFormHiveId('');
    setFormDueAt('');
    setShowForm(false);
    loadData();
  }

  async function handleToggle(taskId: number, completed: boolean) {
    await fetch(`/api/apiary/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    loadData();
  }

  async function handleDelete(taskId: number) {
    await fetch(`/api/apiary/tasks/${taskId}`, { method: 'DELETE' });
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm sm:col-span-3"
              placeholder="Task title *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
            <select
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              value={formHiveId}
              onChange={(e) => setFormHiveId(e.target.value)}
            >
              <option value="">No hive</option>
              {hives.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              type="date"
              value={formDueAt}
              onChange={(e) => setFormDueAt(e.target.value)}
              placeholder="Due date"
            />
            <div className="flex justify-end items-end">
              <Button size="sm" onClick={handleAdd} disabled={!formTitle.trim()}>
                Add
              </Button>
            </div>
          </div>
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
