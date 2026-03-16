'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Todo } from '@my-hub/shared/types';
import PageHeader from '@/components/page-header';
import SectionCard from '@/components/section-card';
import Button from '@/components/button';
import Field from '@/components/field';

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);

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

  async function addTodo() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle('');
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

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="text-gray-400">Loading…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-500">{error}</p>
        {error === 'Not signed in' && (
          <Link href="/auth/signin" className="mt-2 inline-block text-blue-600 underline">
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

      {/* Add form */}
      <SectionCard title="Add item">
        <div className="flex gap-3 items-end">
          <Field label="Title" className="flex-1">
            <input
              className="input"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              autoFocus
            />
          </Field>
          <Button onClick={addTodo} loading={saving} disabled={!title.trim()}>
            Add
          </Button>
        </div>
      </SectionCard>

      {/* Open todos */}
      <SectionCard title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <p className="text-gray-400 text-sm">All done!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 flex-1">Title</th>
                <th className="pb-2 pl-4 text-right">Created</th>
                <th className="pb-2 pl-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {open.map((todo) => (
                <tr key={todo.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{todo.id}</td>
                  <td className="py-2 font-medium">{todo.title}</td>
                  <td className="py-2 pl-4 text-right text-gray-400 text-xs whitespace-nowrap">
                    {new Date(todo.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pl-4 text-right">
                    <button
                      onClick={() => markDone(todo.id)}
                      disabled={marking === todo.id}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {marking === todo.id ? '…' : 'Mark done'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Done todos */}
      {done.length > 0 && (
        <SectionCard title={`Done (${done.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 flex-1">Title</th>
                <th className="pb-2 pl-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {done.map((todo) => (
                <tr key={todo.id} className="opacity-50">
                  <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{todo.id}</td>
                  <td className="py-2 line-through text-gray-500">{todo.title}</td>
                  <td className="py-2 pl-4 text-right text-gray-400 text-xs whitespace-nowrap">
                    {new Date(todo.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </main>
  );
}
