'use client';

import { useEffect, useState } from 'react';
import { cn, apiFetch } from '@/lib/utils';
import { Input } from '@/components';
import { FinFieldCard } from '../ui';
import { FinancialDropdown } from '../FinancialDropdown';
import { finDropdownInputClass } from '../finances.utils';
import { TransactionType, TransactionTypes } from '@my-hub/shared/constants';
import type { BudgetDetailResponse } from '@/app/api/finances/budget/route';
import type { LabelsResponse } from '@/app/api/finances/labels/route';
import { TRANSACTION_TYPE_COLORS } from '../finances.utils';

type Filter = 'all' | TransactionType;

export type ExtraFilterValues = {
  addedByUserId: string;
  label: string;
  amountGte: string;
  amountLte: string;
  search: string;
};

type Member = { userId: string; name: string | null; email: string; initials: string };

type TransactionFiltersProps = {
  typeFilter: Filter;
  extraValues: ExtraFilterValues;
  onTypeChange: (type: Filter) => void;
  onExtraChange: (patch: Partial<ExtraFilterValues>) => void;
};

function computeInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? '';
    const last = parts[parts.length - 1] ?? '';
    if (parts.length >= 2) return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
    return first.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// Matches the ghost-input style used inside FinFieldCard in the modal
const FIELD_INPUT =
  'border-0 bg-transparent p-0 shadow-none focus:ring-0 text-[13px] text-[var(--fin-text)] placeholder:text-[var(--fin-subtle)]';

export function TransactionFilters({ typeFilter, extraValues, onTypeChange, onExtraChange }: TransactionFiltersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<BudgetDetailResponse>('/api/finances/budget', { silentToast: true })
      .then(r =>
        setMembers(
          r.members.map(m => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
            initials: computeInitials(m.name, m.email),
          })),
        ),
      )
      .catch(() => {});
    apiFetch<LabelsResponse>('/api/finances/labels', { silentToast: true })
      .then(r => setLabels(r.labels))
      .catch(() => {});
  }, []);

  const activeCount = [
    typeFilter !== 'all',
    !!extraValues.addedByUserId,
    !!extraValues.label,
    !!extraValues.amountGte,
    !!extraValues.amountLte,
    !!extraValues.search,
  ].filter(Boolean).length;

  function clearAll() {
    onTypeChange('all');
    onExtraChange({ addedByUserId: '', label: '', amountGte: '', amountLte: '', search: '' });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--fin-border)] bg-[var(--fin-card2)] p-3">
      {/* Type segment control — mirrors the modal style */}
      <div className="flex rounded-[9px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-[3px]">
        <button
          type="button"
          onClick={() => onTypeChange('all')}
          className={cn(
            'flex-1 cursor-pointer rounded-[7px] py-[7px] text-xs font-medium transition-colors',
            typeFilter === 'all'
              ? 'bg-[var(--fin-accent)]/15 text-[var(--fin-accent)] outline outline-1 outline-[var(--fin-accent)]/30'
              : 'bg-transparent text-[var(--fin-muted)]',
          )}
        >
          All
        </button>
        {([TransactionTypes.Expense, TransactionTypes.Income, TransactionTypes.Transfer] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={cn(
              'flex-1 cursor-pointer rounded-[7px] py-[7px] text-xs capitalize transition-colors',
              typeFilter === t ? 'font-semibold' : 'bg-transparent text-[var(--fin-muted)]',
            )}
            style={{
              background: typeFilter === t ? TRANSACTION_TYPE_COLORS[t] + '22' : undefined,
              color: typeFilter === t ? TRANSACTION_TYPE_COLORS[t] : undefined,
              outline: typeFilter === t ? `1px solid ${TRANSACTION_TYPE_COLORS[t]}44` : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter fields grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Added by — only when budget has multiple members */}
        {members.length > 1 && (
          <FinFieldCard label="Added by">
            <div className="flex flex-wrap gap-1 pt-0.5">
              <MemberChip
                label="All"
                active={!extraValues.addedByUserId}
                onClick={() => onExtraChange({ addedByUserId: '' })}
              />
              {members.map(m => (
                <MemberChip
                  key={m.userId}
                  label={m.initials}
                  title={m.name ?? m.email}
                  active={extraValues.addedByUserId === m.userId}
                  onClick={() =>
                    onExtraChange({ addedByUserId: extraValues.addedByUserId === m.userId ? '' : m.userId })
                  }
                />
              ))}
            </div>
          </FinFieldCard>
        )}

        {/* Label */}
        <FinFieldCard label="Label">
          <FinancialDropdown
            searchable={false}
            options={labels.map(l => ({ id: l, value: l }))}
            value={extraValues.label || undefined}
            onChange={item => onExtraChange({ label: (item?.id as string) ?? '' })}
            placeholder="All labels"
            clearable
            clearAriaLabel="Clear label filter"
            inputClassName={finDropdownInputClass}
          />
        </FinFieldCard>

        {/* Amount min */}
        <FinFieldCard label="Min amount">
          <Input
            type="number"
            placeholder="0"
            value={extraValues.amountGte}
            onChange={e => onExtraChange({ amountGte: e.target.value })}
            className={FIELD_INPUT}
            min={0}
          />
        </FinFieldCard>

        {/* Amount max */}
        <FinFieldCard label="Max amount">
          <Input
            type="number"
            placeholder="—"
            value={extraValues.amountLte}
            onChange={e => onExtraChange({ amountLte: e.target.value })}
            className={FIELD_INPUT}
            min={0}
          />
        </FinFieldCard>

        {/* Search notes — full width */}
        <FinFieldCard label="Search notes" className="col-span-2">
          <Input
            type="text"
            placeholder="Search in memo…"
            value={extraValues.search}
            onChange={e => onExtraChange({ search: e.target.value })}
            className={FIELD_INPUT}
          />
        </FinFieldCard>
      </div>

      {/* Clear all — only when filters are active */}
      {activeCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={clearAll}
            className="text-[11px] text-[var(--fin-muted)] transition-colors hover:text-[var(--fin-red)]"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

function MemberChip({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'bg-[var(--fin-accent)] text-white'
          : 'bg-[var(--fin-card2)] text-[var(--fin-muted)] hover:text-[var(--fin-text)]',
      )}
    >
      {label}
    </button>
  );
}
