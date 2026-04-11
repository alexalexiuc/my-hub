'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Todo } from '@my-hub/shared/types';
import { PageHeader } from '@/components/PageHeader';
import { apiFetch, ApiError } from '@/lib/utils';
import { SectionCard } from '@/components/SectionCard';
import { Input } from '@/components';
import { PlusOutlineIcon, CheckOutlineIcon, TrashOutlineIcon } from '@/components/icons';

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadTodos = useCallback(async () => {
    try {
      const data = await apiFetch<{ todos: Todo[] }>('/api/todo');
      setTodos(data.todos);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? 'Not signed in' : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  function startAdding() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleSave() {
    if (!title.trim()) {
      setAdding(false);
      setTitle('');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/todo', { method: 'POST', body: { title: title.trim() } });
      setTitle('');
      setAdding(false);
      await loadTodos();
    } finally {
      setSaving(false);
    }
  }

  async function markDone(id: number) {
    setMarking(id);
    try {
      await apiFetch(`/api/todo/${id}`, { method: 'PATCH' });
      await loadTodos();
    } finally {
      setMarking(null);
    }
  }

  async function deleteTodo(id: number) {
    setDeleting(id);
    try {
      await apiFetch(`/api/todo/${id}`, { method: 'DELETE' });
      await loadTodos();
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="text-zinc-400">Loading...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-500">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-indigo-400 underline">
            Sign in
          </Link>
        )}
      </main>
    );
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <PageHeader title="Todo" backHref="/" backLabel="← Home" />

      {/* Open todos */}
      <SectionCard
        title={`Open (${open.length})`}
        className="border-blue-800/50 bg-blue-950/20"
        action={
          <button
            onClick={startAdding}
            aria-label="Add task"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
            title="Add task"
          >
            <PlusOutlineIcon className="size-3" />
            Add
          </button>
        }
      >
        <div className="space-y-1">
          {/* Inline add row */}
          {adding && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-700" />
              <Input
                ref={inputRef}
                variant="ghost"
                placeholder="New task..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setTitle('');
                  }
                }}
                onBlur={handleSave}
                disabled={saving}
              />
              {title.trim() && (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSave();
                  }}
                  className="flex-shrink-0 text-indigo-400 hover:text-indigo-300 transition"
                  title="Save"
                >
                  <CheckOutlineIcon />
                </button>
              )}
            </div>
          )}

          {open.length === 0 && !adding ? (
            <p className="text-zinc-500 text-sm px-1">All caught up!</p>
          ) : (
            open.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2.5 text-sm group"
              >
                <button
                  onClick={() => markDone(todo.id)}
                  disabled={marking === todo.id}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-600 hover:border-indigo-400 hover:bg-indigo-400/20 transition disabled:opacity-50"
                  title="Mark done"
                />
                <span className="flex-1 min-w-0">{todo.title}</span>
                <span className="text-xs text-zinc-600 whitespace-nowrap">
                  {new Date(todo.createdAt).toLocaleDateString()}
                </span>
                {marking === todo.id && <span className="text-xs text-zinc-500">...</span>}
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* Done todos */}
      {done.length > 0 && (
        <SectionCard title={`Done (${done.length})`}>
          <div className="space-y-1">
            {done.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm group opacity-50 hover:opacity-80 transition-opacity"
              >
                <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-600 bg-zinc-700 flex items-center justify-center">
                  <CheckOutlineIcon className="size-2.5 text-zinc-400" />
                </div>
                <span className="flex-1 min-w-0 line-through text-zinc-500">{todo.title}</span>
                <span className="text-xs text-zinc-600 whitespace-nowrap">
                  {new Date(todo.createdAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  disabled={deleting === todo.id}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === todo.id ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <TrashOutlineIcon className="size-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </main>
  );
}
