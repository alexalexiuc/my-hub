'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { Todo } from '@my-hub/shared/types';
import { SectionCard } from '@/components/SectionCard';
import { Input } from '@/components';
import { PlusOutlineIcon, CheckOutlineIcon, TrashOutlineIcon } from '@/components/icons';

interface TodoWidgetProps {
  todos: Todo[];
  loading: boolean;
  onAdd: (title: string) => Promise<number | undefined>;
  onMarkDone: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function TodoWidget({ todos, loading, onAdd, onMarkDone, onDelete }: TodoWidgetProps) {
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
            <PlusOutlineIcon className="size-3" />
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
                    {completing.has(todo.id) && <CheckOutlineIcon className="size-2.5 text-white" />}
                  </button>
                  <span
                    className={`flex-1 min-w-0 truncate transition-all duration-200 ${completing.has(todo.id) ? 'line-through text-zinc-500' : ''}`}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => onDelete(todo.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all duration-200"
                    title="Delete"
                  >
                    <TrashOutlineIcon className="size-3.5" />
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
