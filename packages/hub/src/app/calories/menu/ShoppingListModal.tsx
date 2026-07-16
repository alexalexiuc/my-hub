'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/utils';
import { Modal, Button } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import {
  AddShoppingItemsSchema,
  AddShoppingItemsResponseSchema,
  GetShoppingListResponseSchema,
  UpdateShoppingItemSchema,
} from '@/app/api/calories/menu/menu.schemas';
import { ShoppingListItems } from './ShoppingListItems';
import type { ShoppingItem } from './ShoppingListItems';

interface Props {
  menuId: string;
  weekLabel: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component — a single persisted shopping list for the week. The assistant
// (via MCP) writes it; the user can add, check off, and remove items here.
// ---------------------------------------------------------------------------

export function ShoppingListModal({ menuId, weekLabel, onClose }: Props) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/calories/menu/${menuId}/shopping-list`, { responseSchema: GetShoppingListResponseSchema })
      .then(data => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [menuId]);

  async function handleAdd(text: string) {
    const data = await apiFetch(`/api/calories/menu/${menuId}/shopping-list`, {
      method: 'POST',
      body: { texts: [text] },
      bodySchema: AddShoppingItemsSchema,
      responseSchema: AddShoppingItemsResponseSchema,
      silentToast: true,
    });
    setItems(prev => [...prev, ...data.items]);
  }

  function toggle(item: ShoppingItem) {
    const checked = !item.checked;
    // Optimistic update; revert if the server rejects the change
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, checked } : i)));
    apiFetch(`/api/calories/menu/${menuId}/shopping-list/${item.id}`, {
      method: 'PATCH',
      body: { checked },
      bodySchema: UpdateShoppingItemSchema,
      silentToast: true,
    }).catch(() => {
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, checked: !checked } : i)));
    });
  }

  async function remove(item: ShoppingItem) {
    await apiFetch(`/api/calories/menu/${menuId}/shopping-list/${item.id}`, {
      method: 'DELETE',
      silentToast: true,
    });
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  function copyAll() {
    const text = items.map(i => `- ${i.text}`).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const total = items.length;
  const checkedCount = items.filter(i => i.checked).length;

  return (
    <Modal title="Shopping List" onClose={onClose} className="md:max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 -mt-1">
          <p className="text-xs text-[var(--muted)]">{weekLabel}</p>
          {total > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={copyAll}
              className="inline-flex items-center gap-1"
            >
              <ClipboardIcon className="size-3.5" />
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-[var(--card3)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${(checkedCount / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[var(--muted)] shrink-0">
              {checkedCount}/{total}
            </span>
          </div>
        )}

        <ShoppingListItems
          items={items}
          loading={loading}
          onAdd={handleAdd}
          onToggle={toggle}
          onRemove={item => void remove(item)}
        />

        <p className="text-[10px] text-[var(--subtle)] text-center border-t border-[var(--border)] pt-3">
          Saved to this week&apos;s menu — available on all your devices
        </p>
      </div>
    </Modal>
  );
}
