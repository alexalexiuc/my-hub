'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { DropdownOption } from '../../FinancialDropdown';
import type { PayeeAction, PayeeMapping } from './types';

export type PayeeMappingPanelProps = {
  uniquePayeeValues: string[];
  payeeMappings: Map<string, PayeeMapping>;
  payeeOptions: DropdownOption[];
  categoryOptions: DropdownOption[];
  showCategoryDropdown: boolean;
  onUpdateMapping: (csvValue: string, patch: Partial<PayeeMapping>) => void;
};

export function PayeeMappingPanel({
  uniquePayeeValues,
  payeeMappings,
  payeeOptions,
  categoryOptions,
  showCategoryDropdown,
  onUpdateMapping,
}: PayeeMappingPanelProps) {
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);

  const payeeStats = {
    matched: Array.from(payeeMappings.values()).filter(m => m.action === 'existing' && m.existingPayeeId).length,
    created: Array.from(payeeMappings.values()).filter(m => m.action === 'create').length,
    skipped: Array.from(payeeMappings.values()).filter(m => m.action === 'unmapped').length,
  };

  const isUnresolved = (m: PayeeMapping) =>
    (m.action === 'existing' && m.existingPayeeId === null) || (m.action === 'create' && m.newPayeeName === '');

  const visiblePayeeValues = showUnmatchedOnly
    ? uniquePayeeValues.filter(csvValue => {
        const m = payeeMappings.get(csvValue);
        return m ? isUnresolved(m) : false;
      })
    : uniquePayeeValues;

  const unresolvedCount = uniquePayeeValues.filter(csvValue => {
    const m = payeeMappings.get(csvValue);
    return m ? isUnresolved(m) : false;
  }).length;

  return (
    <div className="w-[300px] flex-shrink-0 rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--fin-border)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[var(--fin-text)]">Payee mapping</div>
          <div className="flex gap-1.5 text-[10px] text-[var(--fin-muted)] flex-shrink-0">
            <span>{payeeStats.matched} matched</span>
            <span>·</span>
            <span>{payeeStats.created} new</span>
            <span>·</span>
            <span>{payeeStats.skipped} skipped</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="text-[10px] text-[var(--fin-muted)]">Match, create, or skip each CSV payee.</div>
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
        {visiblePayeeValues.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--fin-muted)]">All payees resolved</div>
        )}
        {visiblePayeeValues.map(csvValue => {
          const mapping = payeeMappings.get(csvValue);
          if (!mapping) return null;
          const autoMatched = mapping.action === 'existing' && mapping.existingPayeeId !== null;
          return (
            <div key={csvValue} className="flex flex-col gap-2 px-3 py-2.5">
              {/* CSV value */}
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--fin-text)]" title={csvValue}>
                  {csvValue}
                </span>
                {autoMatched && <span className="flex-shrink-0 text-[9px] text-[var(--fin-green)]">● matched</span>}
              </div>

              {/* Match / Create / Skip toggle */}
              <div className="flex overflow-hidden rounded-[6px] border border-[var(--fin-border)] text-[10px]">
                {(['existing', 'create', 'unmapped'] as PayeeAction[]).map(action => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => onUpdateMapping(csvValue, { action })}
                    className={cn(
                      'flex-1 py-1 cursor-pointer transition-colors',
                      mapping.action === action
                        ? 'bg-[var(--fin-accent-d)] text-[var(--fin-accent)] font-semibold'
                        : 'text-[var(--fin-muted)] hover:text-[var(--fin-text)]',
                    )}
                  >
                    {action === 'unmapped' ? 'Skip' : action === 'existing' ? 'Match' : 'Create'}
                  </button>
                ))}
              </div>

              {/* Resolution inputs */}
              {mapping.action === 'existing' && (
                <div className="flex flex-col gap-1.5">
                  <FinancialDropdown
                    options={payeeOptions}
                    value={mapping.existingPayeeId ?? undefined}
                    onChange={opt =>
                      onUpdateMapping(csvValue, {
                        existingPayeeId: opt ? Number(opt.id) : null,
                        existingPayeeName: opt ? String(opt.value) : null,
                      })
                    }
                    placeholder="Select payee…"
                    searchable
                    fuse
                    inputClassName="text-xs"
                  />
                  {showCategoryDropdown && (
                    <FinancialDropdown
                      options={categoryOptions}
                      value={mapping.defaultCategoryId ?? undefined}
                      onChange={opt => onUpdateMapping(csvValue, { defaultCategoryId: opt ? Number(opt.id) : null })}
                      placeholder="Default category…"
                      searchable
                      fuse
                      clearable
                      inputClassName="text-xs"
                    />
                  )}
                </div>
              )}

              {mapping.action === 'create' && (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={mapping.newPayeeName}
                    onChange={e => onUpdateMapping(csvValue, { newPayeeName: e.target.value })}
                    placeholder="Canonical name…"
                    className="w-full rounded-[6px] border border-[var(--fin-border)] bg-[var(--fin-card)] px-2 py-1 text-xs text-[var(--fin-text)] outline-none"
                  />
                  {showCategoryDropdown && (
                    <FinancialDropdown
                      options={categoryOptions}
                      value={mapping.defaultCategoryId ?? undefined}
                      onChange={opt => onUpdateMapping(csvValue, { defaultCategoryId: opt ? Number(opt.id) : null })}
                      placeholder="Default category…"
                      searchable
                      fuse
                      clearable
                      inputClassName="text-xs"
                    />
                  )}
                  {mapping.newPayeeName !== csvValue && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[var(--fin-muted)]">
                      <input
                        type="checkbox"
                        checked={mapping.addAlias}
                        onChange={e => onUpdateMapping(csvValue, { addAlias: e.target.checked })}
                      />
                      Save "{csvValue}" as alias
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
