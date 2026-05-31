'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Field } from '@/components';
import { FinancialDropdown, type DropdownOption } from '../FinancialDropdown';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';

type MergePayeeModalProps = {
  payee: PayeeWithSuggestion;
  allPayees: PayeeWithSuggestion[];
  onClose: () => void;
  onMerged: () => void;
};

export function MergePayeeModal({ payee, allPayees, onClose, onMerged }: MergePayeeModalProps) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: DropdownOption[] = allPayees.filter(p => p.id !== payee.id).map(p => ({ id: p.id, value: p.name }));

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
        <p className="text-xs text-[var(--subtle)]">
          Select a payee to merge into <strong>{payee.name}</strong>. Its transactions will be reassigned and it will be
          deleted. Its name and aliases will be added to <strong>{payee.name}</strong>&apos;s aliases.
        </p>

        <Field label="Payee to merge in">
          <FinancialDropdown
            options={options}
            value={sourceId ?? undefined}
            onChange={item => setSourceId(item ? Number(item.id) : null)}
            placeholder="Search payee…"
            noResultsText="No payees found"
          />
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </FinModalShell>
  );
}
