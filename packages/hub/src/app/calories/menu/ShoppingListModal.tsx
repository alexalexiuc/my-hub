'use client';

import { useState, useMemo } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--shell)] flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Shopping List</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">{weekLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyAll}
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition"
            >
              {copied ? '✓ Copied' : 'Copy all'}
            </button>
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none transition"
            >
              ×
            </button>
          </div>
        </div>

        {/* Progress */}
        {totalItems > 0 && (
          <div className="px-5 py-2 flex items-center gap-2 border-b border-[var(--border)]">
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

        {/* List */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {totalItems === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-4">No meals planned this week.</p>
          ) : (
            CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--muted)] mb-2">{cat}</p>
                <div className="flex flex-col gap-1.5">
                  {grouped[cat]!.map(item => (
                    <label key={item} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked.has(item)}
                        onChange={() => toggle(item)}
                        className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0"
                      />
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--subtle)] text-center">
            Auto-extracted from meal descriptions · review before shopping
          </p>
        </div>
      </div>
    </div>
  );
}
