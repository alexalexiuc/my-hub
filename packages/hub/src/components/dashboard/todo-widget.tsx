'use client';

import { useState, useRef } from 'react';
import type { Todo } from '@my-hub/shared/types';
import SectionCard from '@/components/section-card';

interface TodoWidgetProps {
  todos: Todo[];
  loading: boolean;
  onAdd: (title: string) => Promise<void>;
  onMarkDone: (id: number) => Promise<void>;
}

export default function TodoWidget({ todos, loading, onAdd, onMarkDone }: TodoWidgetProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
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
      await onAdd(title.trim());
      setTitle('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkDone(id: number) {
    setMarking(id);
    try {
      await onMarkDone(id);
    } finally {
      setMarking(null);
    }
  }

  return (
    <SectionCard
      title="Todo"
      className="border-blue-800/50 bg-blue-950/20"
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{open.length} open</span>
          <button
            onClick={startAdding}
            className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition"
            title="Add task"
          >
            <svg
              width="16"
              height="16"
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
        </div>
      }
    >
      {/* Todo list */}
      {loading ? (
        <div className="text-sm text-zinc-500 animate-pulse">Loading...</div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
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
            open.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 rounded-lg bg-zinc-800/50 px-3 py-2 text-sm group">
                <button
                  onClick={() => handleMarkDone(todo.id)}
                  disabled={marking === todo.id}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-zinc-600 hover:border-indigo-400 hover:bg-indigo-400/20 transition disabled:opacity-50"
                  title="Mark done"
                />
                <span className="flex-1 min-w-0 truncate">{todo.title}</span>
                {marking === todo.id && <span className="text-xs text-zinc-500">...</span>}
              </div>
            ))
          )}
        </div>
      )}
    </SectionCard>
  );
}
