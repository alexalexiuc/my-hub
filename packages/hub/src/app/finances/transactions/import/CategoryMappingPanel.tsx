'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { DropdownOption } from '../../FinancialDropdown';
import type { CategoryMapping } from './types';

export type CategoryMappingPanelProps = {
  uniqueCategoryValues: string[];
  categoryMappings: Map<string, CategoryMapping>;
  categoryOptions: DropdownOption[];
  onUpdateMapping: (csvValue: string, categoryId: number | null) => void;
};

export function CategoryMappingPanel({
  uniqueCategoryValues,
  categoryMappings,
  categoryOptions,
  onUpdateMapping,
}: CategoryMappingPanelProps) {
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);

  const matchedCount = Array.from(categoryMappings.values()).filter(m => m.categoryId !== null).length;
  const unresolvedCount = uniqueCategoryValues.filter(v => categoryMappings.get(v)?.categoryId === null).length;

  const visibleValues = showUnmatchedOnly
    ? uniqueCategoryValues.filter(v => categoryMappings.get(v)?.categoryId === null)
    : uniqueCategoryValues;

  return (
    <div className="w-[260px] flex-shrink-0 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--fin-border)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[var(--fin-text)]">Category mapping</div>
          <div className="flex gap-1.5 text-[10px] text-[var(--fin-muted)] flex-shrink-0">
            <span>{matchedCount} matched</span>
            <span>·</span>
            <span>{uniqueCategoryValues.length - matchedCount} unmatched</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="text-[10px] text-[var(--fin-muted)]">Map each CSV category to a system category.</div>
          <button
            type="button"
            onClick={() => setShowUnmatchedOnly(v => !v)}
            className={cn(
              'flex-shrink-0 rounded-[5px] border px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer',
              showUnmatchedOnly
                ? 'border-[var(--fin-accent)] bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                : 'border-[var(--fin-border)] text-[var(--fin-muted)] hover:text-[var(--fin-text)]',
            )}
          >
            {unresolvedCount} unresolved
          </button>
        </div>
      </div>

      {/* Scrollable rows */}
      <div className="max-h-[600px] overflow-y-auto divide-y divide-[var(--fin-border)]">
        {visibleValues.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--fin-muted)]">All categories resolved</div>
        )}
        {visibleValues.map(csvValue => {
          const mapping = categoryMappings.get(csvValue);
          if (!mapping) return null;
          const isMatched = mapping.categoryId !== null;
          return (
            <div key={csvValue} className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--fin-text)]" title={csvValue}>
                  {csvValue}
                </span>
                {isMatched && <span className="flex-shrink-0 text-[9px] text-[var(--fin-green)]">● matched</span>}
              </div>
              <FinancialDropdown
                options={categoryOptions}
                value={mapping.categoryId ?? undefined}
                onChange={opt => onUpdateMapping(csvValue, opt ? Number(opt.id) : null)}
                placeholder="Select category…"
                searchable
                fuse
                clearable
                inputClassName="text-xs"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
