'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/utils';
import { Button } from '@/components';
import { FinModalShell } from '../../FinModalShell';
import type { ImportBatchItem, ImportBatchListResponse } from '@/app/api/finances/transactions/import/route';
import type { ImportRollbackResponse } from '@/app/api/finances/transactions/import/[batchId]/route';
import { CsvImportScreen } from './CsvImportScreen';

function ConfirmRollbackModal({
  batch,
  onClose,
  onConfirmed,
}: {
  batch: ImportBatchItem;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirmed();
    } finally {
      setLoading(false);
    }
  }

  return (
    <FinModalShell onClose={onClose} title="Rollback Import?" className="md:max-w-[400px]">
      <p className="mb-1 text-[13px] text-[var(--fin-muted)]">
        This will permanently delete all{' '}
        <span className="font-semibold text-[var(--fin-text)]">{batch.importedCount}</span> transactions imported from{' '}
        <span className="font-mono font-semibold text-[var(--fin-text)]">{batch.filename}</span> and reverse their
        effect on account balances.
      </p>
      <p className="mb-5 text-[13px] text-[var(--fin-muted)]">This cannot be undone.</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1"
          loading={loading}
          onClick={() => void handleConfirm()}
          style={{ background: 'var(--fin-red)', color: 'var(--fin-on-solid)' }}
        >
          Rollback
        </Button>
      </div>
    </FinModalShell>
  );
}

export default function ImportTransactionsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<ImportBatchItem[]>([]);
  const [confirmBatch, setConfirmBatch] = useState<ImportBatchItem | null>(null);

  const loadBatches = useCallback(async () => {
    const data = await apiFetch<ImportBatchListResponse>('/api/finances/transactions/import');
    setBatches(data.batches);
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function doRollback(batchId: string) {
    await apiFetch<ImportRollbackResponse>(`/api/finances/transactions/import/${batchId}`, { method: 'DELETE' });
    await loadBatches();
    setConfirmBatch(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[22px] font-bold tracking-[-0.02em] text-[var(--fin-text)]">Import Transactions</div>
        <div className="mt-0.5 text-xs text-[var(--fin-muted)]">Upload a CSV file to bulk-import transactions</div>
      </div>
      <CsvImportScreen
        onDone={(batchId, count) => {
          router.push(`/finances/transactions?imported=${encodeURIComponent(batchId)}&count=${count}`);
        }}
        onBack={() => router.push('/finances/transactions')}
      />
      {batches.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold text-[var(--fin-text)]">Previous Imports</div>
          <div className="overflow-hidden rounded-xl border border-[var(--fin-border)] bg-[var(--fin-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fin-border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--fin-muted)]">
                  <th className="px-4 py-2.5 text-left">File</th>
                  <th className="px-4 py-2.5 text-right">Imported</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => (
                  <tr key={b.id} className={i < batches.length - 1 ? 'border-b border-[var(--fin-border)]' : ''}>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--fin-text)]">{b.filename}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-[var(--fin-text)]">
                      {b.importedCount} / {b.rowCount}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--fin-muted)]">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          b.status === 'rolled_back'
                            ? 'rounded-full bg-[var(--fin-muted)]/15 px-2 py-0.5 text-[11px] text-[var(--fin-muted)]'
                            : 'rounded-full bg-[var(--fin-green)]/15 px-2 py-0.5 text-[11px] text-[var(--fin-green)]'
                        }
                      >
                        {b.status === 'rolled_back' ? 'Rolled back' : 'Imported'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {b.status !== 'rolled_back' && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmBatch(b)}>
                          Rollback
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {confirmBatch && (
        <ConfirmRollbackModal
          batch={confirmBatch}
          onClose={() => setConfirmBatch(null)}
          onConfirmed={() => doRollback(confirmBatch.id)}
        />
      )}
    </div>
  );
}
