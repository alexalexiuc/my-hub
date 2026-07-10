'use client';

import { useState } from 'react';
import { Input } from '@/components';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import type { TransactionListItem, TransactionMutationResponse } from '@/app/api/finances/transactions/route';

type CorrectionEditModalProps = {
  transaction: TransactionListItem;
  currency: string;
  onClose: () => void;
  onSaved: (result?: TransactionMutationResponse) => void;
};

export function CorrectionEditModal({ transaction, currency, onClose, onSaved }: CorrectionEditModalProps) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [date, setDate] = useState(transaction.date);
  const [saving, setSaving] = useState(false);

  const parsed = parseFloat(amount);
  const isInvalid = isNaN(parsed) || parsed <= 0 || !date;

  const title = transaction.notes === 'Initial Balance' ? 'Edit Initial Balance' : 'Edit Balance Correction';

  async function handleSave() {
    if (isInvalid || saving) return;
    setSaving(true);
    try {
      const result = await apiFetch<TransactionMutationResponse>(`/api/finances/transactions/${transaction.id}`, {
        method: 'PATCH',
        body: { amount: parsed, date },
      });
      onClose();
      onSaved(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FinModalShell
      onClose={onClose}
      title={title}
      className="md:max-w-[400px]"
      onSubmit={handleSave}
      submitLabel="Save"
      submitDisabled={isInvalid}
      submitLoading={saving}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-[10px]">
          <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Account</div>
          <div className="text-[13px] text-[var(--muted)]">{transaction.accountName}</div>
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-[10px]">
          <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Amount ({currency})</div>
          <Input
            autoFocus
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            variant="ghost"
            className="w-full border-none text-[15px] font-semibold text-[var(--text)]"
          />
        </div>

        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-[10px]">
          <div className="mb-1 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">Date</div>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            variant="ghost"
            className="w-full border-none text-[13px] text-[var(--text)]"
          />
        </div>
      </div>
    </FinModalShell>
  );
}
