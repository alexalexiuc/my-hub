'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { Todo } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';

interface TodoWidgetProps {
  todos: Todo[];
  loading: boolean;
  onAdd: (title: string) => Promise<number | undefined>;
  onMarkDone: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function TodoWidget({ todos, loading, onAdd, onMarkDone, onDelete }: TodoWidgetProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<Set<number>>(new Set());
  const [newlyAdded, setNewlyAdded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = todos.filter((t) => !t.done);

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
      const id = await onAdd(title.trim());
      setTitle('');
      setAdding(false);
      if (id !== undefined) {
        setNewlyAdded(id);
        setTimeout(() => setNewlyAdded(null), 50);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkDone(id: number) {
    setCompleting((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      try {
        await onMarkDone(id);
      } finally {
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 700);
  }

  return (
    <SectionCard
      title="Todo"
      className="border-blue-800/50 bg-gradient-to-br from-blue-950/40 to-zinc-900"
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{open.length} open</span>
          <button
            onClick={startAdding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-all"
            title="Add task"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>
      }
    >
      {/* Todo list */}
      {loading ? (
        <div className="text-sm text-zinc-500 animate-pulse">Loading...</div>
      ) : (
        <div className="space-y-2 mt-2">
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
            <p className="text-sm text-zinc-500 px-1">All caught up!</p>
          ) : (
            <>
              {open.slice(0, 5).map((todo) => (
                <div
                  key={todo.id}
                  className={`flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm group transition-all duration-700 ${
                    completing.has(todo.id)
                      ? 'opacity-0 translate-x-6'
                      : newlyAdded === todo.id
                        ? 'opacity-0 -translate-y-2'
                        : 'opacity-100 translate-y-0 translate-x-0'
                  }`}
                >
                  <button
                    onClick={() => handleMarkDone(todo.id)}
                    disabled={completing.has(todo.id)}
                    className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                      completing.has(todo.id)
                        ? 'border-indigo-400 bg-indigo-400'
                        : 'border-zinc-600 hover:border-indigo-400 hover:bg-indigo-400/20'
                    }`}
                    title="Mark done"
                  >
                    {completing.has(todo.id) && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`flex-1 min-w-0 truncate transition-all duration-200 ${completing.has(todo.id) ? 'line-through text-zinc-500' : ''}`}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await onDelete(todo.id);
                      } catch (error) {
                        console.error('Failed to delete todo', error);
                      }
                    }}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all duration-200"
                    title="Delete"
                    aria-label="Delete todo"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              ))}
              {open.length > 5 && (
                <Link href="/todo" className="block text-xs text-zinc-500 hover:text-zinc-300 transition px-1 pt-1">
                  + {open.length - 5} more → View all
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}
