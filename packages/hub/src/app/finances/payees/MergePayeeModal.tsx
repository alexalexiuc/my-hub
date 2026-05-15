'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Field, Select } from '@/components';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';

type MergePayeeModalProps = {
  payee: PayeeWithSuggestion;
  allPayees: PayeeWithSuggestion[];
  onClose: () => void;
  onMerged: () => void;
};

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
          <Select
            value={sourceId}
            onChange={e => setSourceId(e.target.value ? Number(e.target.value) : '')}
            options={options.map(p => ({ value: p.id, label: p.name }))}
          >
            <option value="">Select payee…</option>
          </Select>
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </FinModalShell>
  );
}
