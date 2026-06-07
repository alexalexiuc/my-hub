'use client';

import { useState, useMemo } from 'react';
import { Modal, Button, Checkbox } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import { extractItems, categorise, CATEGORY_ORDER } from './shopping-list-utils';

interface Meal {
  description: string;
}

interface Props {
  meals: Meal[];
  weekLabel: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShoppingListModal({ meals, weekLabel, onClose }: Props) {
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

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  function toggle(item: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }

  function copyAll() {
    const text = CATEGORY_ORDER.filter(cat => grouped[cat]?.length)
      .map(cat => `${cat}:\n${grouped[cat]!.map(i => `- ${i}`).join('\n')}`)
      .join('\n\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const totalItems = Object.values(grouped).flat().length;
  const checkedCount = checked.size;

  return (
    <Modal title="Shopping List" onClose={onClose} className="md:max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 -mt-1">
          <p className="text-xs text-[var(--muted)]">{weekLabel}</p>
          <Button type="button" variant="ghost" size="xs" onClick={copyAll} className="inline-flex items-center gap-1">
            <ClipboardIcon className="size-3.5" />
            {copied ? 'Copied' : 'Copy all'}
          </Button>
        </div>

        {totalItems > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-[var(--card3)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-[var(--muted)] shrink-0">
              {checkedCount}/{totalItems}
            </span>
          </div>
        )}

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
                      <Checkbox checked={checked.has(item)} onChange={() => toggle(item)} className="shrink-0" />
                      <span
                        className={`text-sm capitalize transition ${
                          checked.has(item)
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

        <p className="text-[10px] text-[var(--subtle)] text-center border-t border-[var(--border)] pt-3">
          Auto-extracted from meal descriptions · review before shopping
        </p>
      </div>
    </Modal>
  );
}
