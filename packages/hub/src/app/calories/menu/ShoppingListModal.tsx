'use client';

import { useState, useEffect, useMemo } from 'react';
import type { z } from 'zod';
import { apiFetch } from '@/lib/utils';
import { Modal, Button, Checkbox, Input } from '@/components';
import { ClipboardIcon, PlusOutlineIcon, TrashOutlineIcon } from '@/components/icons';
import {
  AddShoppingItemsSchema,
  AddShoppingItemsResponseSchema,
  GetShoppingListResponseSchema,
  UpdateShoppingItemSchema,
} from '@/app/api/calories/menu/menu.schemas';
import type { ShoppingItemRecordSchema } from '@/app/api/calories/menu/menu.schemas';
import { extractItems, categorise, CATEGORY_ORDER } from './shopping-list-utils';

type ShoppingItem = z.infer<typeof ShoppingItemRecordSchema>;

interface Meal {
  description: string;
}

interface Props {
  meals: Meal[];
  menuId: string;
  weekLabel: string;
  onClose: () => void;
}

type ListTab = 'auto' | 'manual';

const TABS: { id: ListTab; label: string }[] = [
  { id: 'auto', label: 'Auto-generated' },
  { id: 'manual', label: 'Manual list' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShoppingListModal({ meals, menuId, weekLabel, onClose }: Props) {
  const [tab, setTab] = useState<ListTab>('auto');

  // ── Auto-generated list (recomputed from meal descriptions, session-only) ──
  const grouped = useMemo(() => {
    const rawItems = meals.flatMap(m => extractItems(m.description));
    const unique = [...new Set(rawItems)].filter(Boolean);
    const result: Record<string, string[]> = {};
    for (const item of unique) {
      const cat = categorise(item);
      (result[cat] ??= []).push(item);
    }
    return result;
  }, [meals]);
  const autoItems = useMemo(() => Object.values(grouped).flat(), [grouped]);
  const [autoChecked, setAutoChecked] = useState<Set<string>>(new Set());

  // ── Manual list (persisted in DB per menu) ─────────────────────────────────
  const [manualItems, setManualItems] = useState<ShoppingItem[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualLoaded, setManualLoaded] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);

  // Fetched lazily on first switch to the manual tab — the default auto tab
  // never needs it, so opening the modal costs no network/DB work.
  useEffect(() => {
    if (tab !== 'manual' || manualLoaded) return;
    let cancelled = false;
    apiFetch(`/api/calories/menu/${menuId}/shopping-list`, { responseSchema: GetShoppingListResponseSchema })
      .then(data => {
        if (cancelled) return;
        setManualItems(data.items);
        setManualLoaded(true);
      })
      .catch(() => {
        // Avoid unhandled promise rejections; allow retry on next tab switch.
        if (!cancelled) setManualItems([]);
      })
      .finally(() => {
        if (!cancelled) setManualLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, manualLoaded, menuId]);

  const [copied, setCopied] = useState(false);

  function toggleAuto(item: string) {
    setAutoChecked(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }

  async function addItems(texts: string[]) {
    setAdding(true);
    try {
      const data = await apiFetch(`/api/calories/menu/${menuId}/shopping-list`, {
        method: 'POST',
        body: { texts },
        bodySchema: AddShoppingItemsSchema,
        responseSchema: AddShoppingItemsResponseSchema,
        silentToast: true,
      });
      setManualItems(prev => [...prev, ...data.items]);
    } finally {
      setAdding(false);
    }
  }

  async function handleAddManual() {
    const text = newItem.trim();
    if (!text) return;
    await addItems([text]);
    setNewItem('');
  }

  function toggleManual(item: ShoppingItem) {
    const checked = !item.checked;
    // Optimistic update; revert if the server rejects the change
    setManualItems(prev => prev.map(i => (i.id === item.id ? { ...i, checked } : i)));
    apiFetch(`/api/calories/menu/${menuId}/shopping-list/${item.id}`, {
      method: 'PATCH',
      body: { checked },
      bodySchema: UpdateShoppingItemSchema,
      silentToast: true,
    }).catch(() => {
      setManualItems(prev => prev.map(i => (i.id === item.id ? { ...i, checked: !checked } : i)));
    });
  }

  async function removeManual(item: ShoppingItem) {
    await apiFetch(`/api/calories/menu/${menuId}/shopping-list/${item.id}`, {
      method: 'DELETE',
      silentToast: true,
    });
    setManualItems(prev => prev.filter(i => i.id !== item.id));
  }

  function copyAll() {
    const text =
      tab === 'auto'
        ? CATEGORY_ORDER.filter(cat => grouped[cat]?.length)
            .map(cat => `${cat}:\n${grouped[cat]!.map(i => `- ${i}`).join('\n')}`)
            .join('\n\n')
        : manualItems.map(i => `- ${i.text}`).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const totalItems = tab === 'auto' ? autoItems.length : manualItems.length;
  const checkedCount = tab === 'auto' ? autoChecked.size : manualItems.filter(i => i.checked).length;

  return (
    <Modal title="Shopping List" onClose={onClose} className="md:max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 -mt-1">
          <p className="text-xs text-[var(--muted)]">{weekLabel}</p>
          {totalItems > 0 && (
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

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {totalItems > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-[var(--card3)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${(checkedCount / totalItems) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[var(--muted)] shrink-0">
              {checkedCount}/{totalItems}
            </span>
          </div>
        )}

        {tab === 'auto' ? (
          <div className="flex flex-col gap-5">
            {totalItems === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-4">No meals planned this week.</p>
            ) : (
              CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => (
                <div key={cat}>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted)] mb-2">{cat}</p>
                  <div className="flex flex-col gap-1.5">
                    {grouped[cat]!.map(item => (
                      <label key={item} className="flex items-center gap-2.5 cursor-pointer group">
                        <Checkbox
                          checked={autoChecked.has(item)}
                          onChange={() => toggleAuto(item)}
                          className="shrink-0"
                        />
                        <span
                          className={`text-sm capitalize transition ${
                            autoChecked.has(item)
                              ? 'line-through text-[var(--subtle)]'
                              : 'text-[var(--text)] group-hover:text-[var(--accent)]'
                          }`}
                        >
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Add item */}
            <form
              onSubmit={e => {
                e.preventDefault();
                void handleAddManual();
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

            {manualLoading ? (
              <p className="text-sm text-[var(--muted)] text-center py-4">Loading…</p>
            ) : manualItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-sm text-[var(--muted)] text-center">Your manual list is empty.</p>
                {autoItems.length > 0 && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => void addItems(autoItems)}>
                    Import auto-generated items
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {manualItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5 group">
                    <Checkbox checked={item.checked} onChange={() => toggleManual(item)} className="shrink-0" />
                    <span
                      className={`flex-1 text-sm transition ${
                        item.checked ? 'line-through text-[var(--subtle)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeManual(item)}
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
        )}

        <p className="text-[10px] text-[var(--subtle)] text-center border-t border-[var(--border)] pt-3">
          {tab === 'auto'
            ? 'Auto-extracted from meal descriptions · review before shopping'
            : "Saved to this week's menu — available on all your devices"}
        </p>
      </div>
    </Modal>
  );
}
