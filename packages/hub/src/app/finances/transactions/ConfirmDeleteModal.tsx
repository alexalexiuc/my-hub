'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button } from '@/components';

type ConfirmDeleteModalProps = {
  transactionId: number;
  onClose: () => void;
  onDeleted: () => void;
};

export function ConfirmDeleteModal({ transactionId, onClose, onDeleted }: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await apiFetch(`/api/finances/transactions/${transactionId}`, { method: 'DELETE' });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <FinModalShell onClose={onClose} title="Delete Transaction?" className="md:max-w-[360px]">
      <p className="mb-5 text-[13px] text-[var(--fin-muted)]">
        This will permanently remove the transaction and reverse its effect on account balances. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          loading={deleting}
          onClick={handleConfirm}
          style={{ background: 'var(--fin-red)', color: 'var(--fin-on-solid)' }}
        >
          Delete
        </Button>
      </div>
    </FinModalShell>
  );
}
