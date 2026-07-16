'use client';

import { useState } from 'react';
import type { z } from 'zod';
import { Button, Checkbox, Input } from '@/components';
import { PlusOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import type { ShoppingItemRecordSchema } from '@/app/api/calories/menu/menu.schemas';

export type ShoppingItem = z.infer<typeof ShoppingItemRecordSchema>;

export interface ShoppingListItemsProps {
  items: ShoppingItem[];
  loading: boolean;
  onAdd: (text: string) => Promise<void>;
  onToggle: (item: ShoppingItem) => void;
  onRemove: (item: ShoppingItem) => void;
}

/** The week's persisted shopping list — written by the assistant, editable by the user (add / check / remove). */
export function ShoppingListItems({ items, loading, onAdd, onToggle, onRemove }: ShoppingListItemsProps) {
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleSubmit() {
    const text = newItem.trim();
    if (!text) return;

    setAdding(true);
    try {
      await onAdd(text);
      setNewItem('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Add item */}
      <form
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex gap-1.5"
      >
        <Input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Add an item…"
          className="flex-1 text-sm"
        />
        <Button
          type="submit"
          variant="accent"
          size="sm"
          disabled={!newItem.trim()}
          loading={adding}
          aria-label="Add item"
          className="shrink-0 inline-flex items-center"
        >
          <PlusOutlineIcon className="size-4" />
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--muted)] text-center py-4">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-4">
          No shopping list yet — ask the assistant to build one for this week, or add items above.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2.5 group">
              <Checkbox checked={item.checked} onChange={() => onToggle(item)} className="shrink-0" />
              <span
                className={`flex-1 text-sm transition ${
                  item.checked ? 'line-through text-[var(--subtle)]' : 'text-[var(--text)]'
                }`}
              >
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item.text}`}
                className="text-[var(--muted)] hover:text-red-400 transition-colors shrink-0"
              >
                <TrashOutlineIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
