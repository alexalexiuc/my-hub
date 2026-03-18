'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Todo } from '@my-hub/shared/types';
import PageHeader from '@/components/page-header';
import SectionCard from '@/components/section-card';

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
      const res = await fetch('/api/todo');
      if (res.status === 401) {
        setError('Not signed in');
        return;
      }
      const data = (await res.json()) as { todos: Todo[] };
      setTodos(data.todos);
    } catch (e) {
      setError(String(e));
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
      await fetch('/api/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
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
      await fetch(`/api/todo/${id}`, { method: 'PATCH' });
      await loadTodos();
    } finally {
      setMarking(null);
    }
  }

  async function deleteTodo(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/todo/${id}`, { method: 'DELETE' });
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
            className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
            title="Add task"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      >
        <div className="space-y-1">
          {/* Inline add row */}
          {adding && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-700" />
              <input
                ref={inputRef}
                className="flex-1 min-w-0 bg-transparent border-b border-zinc-600 focus:border-indigo-400 outline-none text-sm py-0.5 placeholder:text-zinc-600 transition-colors"
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
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
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
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-400"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
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
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
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
