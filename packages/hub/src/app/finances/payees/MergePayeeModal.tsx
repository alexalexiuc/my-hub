'use client';

import { useState, useRef, useMemo } from 'react';
import { apiFetch, cn } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Field } from '@/components';
import { ChevronDownOutlineIcon } from '@/components/icons';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';

type MergePayeeModalProps = {
  payee: PayeeWithSuggestion;
  allPayees: PayeeWithSuggestion[];
  onClose: () => void;
  onMerged: () => void;
};

function SearchablePayeeSelect({
  payees,
  value,
  onChange,
}: {
  payees: PayeeWithSuggestion[];
  value: number | '';
  onChange: (id: number | '') => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const selected = useMemo(() => payees.find(p => p.id === value), [payees, value]);

  const filtered = useMemo(
    () =>
      query.trim() ? payees.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : payees,
    [payees, query],
  );

  function handleSelect(id: number) {
    clearTimeout(blurTimeout.current);
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative">
      <div
        className="flex cursor-text items-center gap-2 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 py-2.5"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent text-[13px] text-[var(--fin-text)] outline-none placeholder:text-[var(--fin-subtle)]"
          placeholder={selected ? selected.name : 'Search payee…'}
          value={open ? query : (selected?.name ?? '')}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => { blurTimeout.current = setTimeout(() => setOpen(false), 150); }}
        />
        <ChevronDownOutlineIcon
          className={cn(
            'size-3.5 shrink-0 text-[var(--fin-subtle)] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card)] shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-[var(--fin-subtle)]">No payees found</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => handleSelect(p.id)}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--fin-card2)]',
                  p.id === value ? 'font-semibold text-[var(--fin-text)]' : 'text-[var(--fin-muted)]',
                )}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function MergePayeeModal({ payee, allPayees, onClose, onMerged }: MergePayeeModalProps) {
  const [sourceId, setSourceId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = allPayees.filter(p => p.id !== payee.id);

  async function handleSubmit() {
    if (!sourceId) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/finances/payees/merge', {
        method: 'POST',
        body: { targetId: payee.id, sourceIds: [sourceId] },
      });
      onMerged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
      setSubmitting(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={`Merge into "${payee.name}"`}
      className="md:max-w-[420px]"
      onSubmit={handleSubmit}
      submitLabel="Merge"
      submitDisabled={!sourceId}
      submitLoading={submitting}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--fin-subtle)]">
          Select a payee to merge into <strong>{payee.name}</strong>. Its transactions will be reassigned and it will be
          deleted. Its name and aliases will be added to <strong>{payee.name}</strong>&apos;s aliases.
        </p>

        <Field label="Payee to merge in">
          <SearchablePayeeSelect payees={options} value={sourceId} onChange={setSourceId} />
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </FinModalShell>
  );
}
