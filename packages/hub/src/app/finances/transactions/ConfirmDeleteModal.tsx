'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { ConfirmModal } from '@/components';

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
    <ConfirmModal
      title="Delete Transaction?"
      message="This will permanently remove the transaction and reverse its effect on account balances. This cannot be undone."
      onConfirm={handleConfirm}
      onCancel={onClose}
      confirmLabel="Delete"
      confirmStyle={{ background: 'var(--red)', color: 'var(--on-solid)' }}
      loading={deleting}
    />
  );
}
